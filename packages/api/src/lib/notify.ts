import type prisma from "@receivingX/db";
import { getObjectBuffer } from "@receivingX/storage";
import { buildReceivingSummaryEmail, sendGraphMail, type GraphAttachment, type ReceivingSummaryRow } from "@receivingX/mailer";
import { env } from "@receivingX/env/server";

type Db = typeof prisma;

const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024; // stay well under Graph's inline limits

type SessionWithDetails = Awaited<ReturnType<typeof loadSession>>;

async function loadSession(db: Db, sessionId: string) {
  return db.receivingSession.findUniqueOrThrow({
    where: { id: sessionId },
    include: {
      receiver: true,
      location: true,
      packages: {
        where: { status: { not: "VOIDED" } },
        include: {
          photos: true,
          serials: true,
          salesOrderLine: { include: { salesOrder: { include: { customer: true, salesRep: true } }, vendor: true } },
        },
      },
    },
  });
}

function toRow(pkg: SessionWithDetails["packages"][number]): ReceivingSummaryRow {
  const line = pkg.salesOrderLine;
  return {
    customer: line?.salesOrder.customer.name ?? "(unmatched)",
    orderDate: line ? new Date(line.salesOrder.orderDate).toLocaleDateString() : "",
    vendor: line?.vendor?.name ?? "",
    po: line?.poNumber ?? pkg.trackingNumber ?? pkg.publicId,
    qty: pkg.qtyReceived,
    pn: line?.partNumber ?? "",
    description: line?.description ?? pkg.notes ?? "",
    serials: pkg.serials.map((s) => s.serial),
    received: new Date(pkg.receivedAt).toLocaleDateString(),
    eta: line?.eta ? new Date(line.eta).toLocaleDateString() : "",
  };
}

async function attachmentsFor(packages: SessionWithDetails["packages"]): Promise<GraphAttachment[]> {
  const attachments: GraphAttachment[] = [];
  let totalBytes = 0;
  for (const pkg of packages) {
    for (const photo of pkg.photos) {
      if (totalBytes > MAX_ATTACHMENT_BYTES) return attachments;
      try {
        const buffer = await getObjectBuffer(photo.objectKey);
        totalBytes += buffer.byteLength;
        attachments.push({
          name: `${pkg.publicId}-${photo.kind.toLowerCase()}.jpg`,
          contentType: photo.mimeType || "image/jpeg",
          contentBytes: buffer.toString("base64"),
        });
      } catch {
        // Photo missing from storage - skip rather than fail the whole send.
      }
    }
  }
  return attachments;
}

/**
 * Finishes a receiving session: builds and sends the summary email(s) per
 * docs/PLAN.md 5.B (one full email to receiving/accounting, one per sales
 * rep scoped to their own rows), and records Notification rows for the
 * resend/audit UI.
 */
export async function sendSessionNotifications(db: Db, sessionId: string): Promise<void> {
  const session = await loadSession(db, sessionId);
  if (session.packages.length === 0) return;

  const sessionDate = new Date(session.startedAt).toLocaleDateString();
  const stats = {
    packages: session.packages.length,
    lineItems: new Set(session.packages.map((p) => p.salesOrderLineId).filter(Boolean)).size,
    serials: session.packages.reduce((n, p) => n + p.serials.length, 0),
  };

  const allRows = session.packages.map(toRow);
  const attachments = await attachmentsFor(session.packages);

  const receivingEmails = [
    ...(session.location.receivingEmail ? [session.location.receivingEmail] : []),
    ...(env.RECEIVING_EMAIL ? [env.RECEIVING_EMAIL] : []),
  ];
  const accountingEmails = [
    ...session.location.accountingEmails,
    ...(env.ACCOUNTING_EMAILS ? env.ACCOUNTING_EMAILS.split(",").map((s) => s.trim()) : []),
  ];
  const primaryRecipients = Array.from(new Set([...receivingEmails, ...accountingEmails])).filter(Boolean);

  const sends: { to: string[]; rows: ReceivingSummaryRow[] }[] = [];
  if (primaryRecipients.length > 0) {
    sends.push({ to: primaryRecipients, rows: allRows });
  }

  const repGroups = new Map<string, { email: string; rows: ReceivingSummaryRow[] }>();
  for (const pkg of session.packages) {
    const rep = pkg.salesOrderLine?.salesOrder.salesRep;
    if (!rep?.email) continue;
    const existing = repGroups.get(rep.id);
    const row = toRow(pkg);
    if (existing) existing.rows.push(row);
    else repGroups.set(rep.id, { email: rep.email, rows: [row] });
  }
  for (const group of repGroups.values()) {
    sends.push({ to: [group.email], rows: group.rows });
  }

  for (const send of sends) {
    const { subject, html, text } = buildReceivingSummaryEmail({
      locationName: session.location.name,
      receiverName: session.receiver.name,
      sessionDate,
      rows: send.rows,
      stats: {
        packages: send.rows.length,
        lineItems: stats.lineItems,
        serials: send.rows.reduce((n, r) => n + r.serials.length, 0),
      },
      appUrl: env.APP_URL,
      sessionId: session.id,
      footerAddress: session.location.address ?? undefined,
    });

    const result = await sendGraphMail({ subject, html, text, to: send.to, attachments });

    await db.notification.create({
      data: {
        sessionId: session.id,
        toEmails: send.to,
        subject,
        status: result.ok ? "SENT" : "FAILED",
        error: result.ok ? null : result.error,
        sentAt: result.ok ? new Date() : null,
      },
    });
  }
}

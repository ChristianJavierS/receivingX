/**
 * Table-based, inline-styled HTML email so it renders correctly in Outlook
 * desktop (Word rendering engine) as well as webmail. Matches the columns of
 * the original receiving spreadsheet, per ReceivingX.md and docs/DESIGN.md.
 */

const NAVY = "#0A2340";
const GOLD = "#FFC220";
const GRAY_50 = "#F7F8FA";
const GRAY_200 = "#E3E7EC";
const BLACK = "#0B0B0D";

export type ReceivingSummaryRow = {
  customer: string;
  orderDate: string;
  vendor: string;
  po: string;
  qty: number;
  pn: string;
  description: string;
  serials: string[];
  received: string;
  eta: string;
};

export type ReceivingSummaryInput = {
  locationName: string;
  receiverName: string;
  sessionDate: string;
  rows: ReceivingSummaryRow[];
  stats: { packages: number; lineItems: number; serials: number };
  appUrl: string;
  sessionId: string;
  footerAddress?: string;
};

function esc(value: string | number): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function buildReceivingSummaryEmail(input: ReceivingSummaryInput): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `Receiving notification - ${input.locationName} - ${input.sessionDate} (${input.stats.packages} package${input.stats.packages === 1 ? "" : "s"})`;

  const rowsHtml = input.rows
    .map(
      (r, i) => `
      <tr style="background:${i % 2 === 0 ? "#FFFFFF" : GRAY_50};border-left:3px solid ${r.received ? "#00B5D8" : GOLD};">
        <td style="padding:10px 12px;font:14px/1.4 Arial,sans-serif;color:${BLACK};">${esc(r.customer)}</td>
        <td style="padding:10px 12px;font:14px/1.4 Arial,sans-serif;color:${BLACK};white-space:nowrap;">${esc(r.orderDate)}</td>
        <td style="padding:10px 12px;font:14px/1.4 Arial,sans-serif;color:${BLACK};">${esc(r.vendor)}</td>
        <td style="padding:10px 12px;font:14px/1.4 'Courier New',monospace;color:${BLACK};">${esc(r.po)}</td>
        <td style="padding:10px 12px;font:14px/1.4 Arial,sans-serif;color:${BLACK};text-align:right;">${esc(r.qty)}</td>
        <td style="padding:10px 12px;font:14px/1.4 'Courier New',monospace;color:${BLACK};">${esc(r.pn)}</td>
        <td style="padding:10px 12px;font:13px/1.4 Arial,sans-serif;color:${BLACK};">${esc(r.description)}</td>
        <td style="padding:10px 12px;font:13px/1.4 'Courier New',monospace;color:${BLACK};">${esc(r.serials.join(", "))}</td>
        <td style="padding:10px 12px;font:14px/1.4 Arial,sans-serif;color:${BLACK};white-space:nowrap;">${esc(r.received)}</td>
        <td style="padding:10px 12px;font:14px/1.4 Arial,sans-serif;color:${BLACK};white-space:nowrap;">${esc(r.eta)}</td>
      </tr>`,
    )
    .join("");

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:${GRAY_50};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${GRAY_50};">
      <tr>
        <td align="center">
          <table role="presentation" width="680" cellpadding="0" cellspacing="0" style="background:#FFFFFF;margin:24px 0;">
            <tr>
              <td style="background:${NAVY};padding:24px 28px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="font:bold 20px/1.2 Arial,sans-serif;color:#FFFFFF;">AM/PM Receiving</td>
                    <td align="right" style="font:12px/1.2 Arial,sans-serif;color:#BFD3E8;">${esc(input.sessionDate)}</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr><td style="height:4px;background:${GOLD};"></td></tr>
            <tr>
              <td style="padding:20px 28px 4px 28px;font:14px/1.5 Arial,sans-serif;color:${BLACK};">
                ${input.stats.packages} package${input.stats.packages === 1 ? "" : "s"} received at
                <strong>${esc(input.locationName)}</strong> by <strong>${esc(input.receiverName)}</strong>.
              </td>
            </tr>
            <tr>
              <td style="padding:12px 28px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${GRAY_200};">
                  <thead>
                    <tr style="background:${NAVY};">
                      <th align="left" style="padding:10px 12px;font:bold 12px Arial,sans-serif;color:#FFFFFF;">Customer</th>
                      <th align="left" style="padding:10px 12px;font:bold 12px Arial,sans-serif;color:#FFFFFF;">Order Date</th>
                      <th align="left" style="padding:10px 12px;font:bold 12px Arial,sans-serif;color:#FFFFFF;">Vendor</th>
                      <th align="left" style="padding:10px 12px;font:bold 12px Arial,sans-serif;color:#FFFFFF;">PO</th>
                      <th align="right" style="padding:10px 12px;font:bold 12px Arial,sans-serif;color:#FFFFFF;">Qty</th>
                      <th align="left" style="padding:10px 12px;font:bold 12px Arial,sans-serif;color:#FFFFFF;">PN</th>
                      <th align="left" style="padding:10px 12px;font:bold 12px Arial,sans-serif;color:#FFFFFF;">Description</th>
                      <th align="left" style="padding:10px 12px;font:bold 12px Arial,sans-serif;color:#FFFFFF;">SN</th>
                      <th align="left" style="padding:10px 12px;font:bold 12px Arial,sans-serif;color:#FFFFFF;">Received</th>
                      <th align="left" style="padding:10px 12px;font:bold 12px Arial,sans-serif;color:#FFFFFF;">ETA</th>
                    </tr>
                  </thead>
                  <tbody>${rowsHtml}</tbody>
                </table>
              </td>
            </tr>
            <tr>
              <td style="background:${BLACK};padding:16px 28px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="center" style="font:12px Arial,sans-serif;color:#9AA3AF;">Packages<br/><span style="font:bold 20px Arial,sans-serif;color:#FFFFFF;">${input.stats.packages}</span></td>
                    <td align="center" style="font:12px Arial,sans-serif;color:#9AA3AF;">Line items<br/><span style="font:bold 20px Arial,sans-serif;color:#FFFFFF;">${input.stats.lineItems}</span></td>
                    <td align="center" style="font:12px Arial,sans-serif;color:#9AA3AF;">Serials<br/><span style="font:bold 20px Arial,sans-serif;color:#FFFFFF;">${input.stats.serials}</span></td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px;font:12px/1.6 Arial,sans-serif;color:#6B7280;">
                Photos of each label/packing slip are attached to this email.
                <a href="${esc(input.appUrl)}/sessions/${esc(input.sessionId)}" style="color:${NAVY};">View this session in ReceivingX</a>.
                <br/>${input.footerAddress ? esc(input.footerAddress) + "<br/>" : ""}Reply to this email to reach USA Receiving.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const textRows = input.rows
    .map(
      (r) =>
        `${r.customer} | ${r.orderDate} | ${r.vendor} | PO ${r.po} | Qty ${r.qty} | ${r.pn} | ${r.description} | SN ${r.serials.join(", ")} | Received ${r.received} | ETA ${r.eta}`,
    )
    .join("\n");

  const text = `AM/PM Receiving - ${input.locationName} - ${input.sessionDate}
${input.stats.packages} package(s) received by ${input.receiverName}.

${textRows}

Packages: ${input.stats.packages}  Line items: ${input.stats.lineItems}  Serials: ${input.stats.serials}
View this session: ${input.appUrl}/sessions/${input.sessionId}
Reply to this email to reach USA Receiving.`;

  return { subject, html, text };
}

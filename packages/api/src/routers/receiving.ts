import { checkInToInventree } from "@receivingX/inventree";
import { extractFieldsFromText, runOcr } from "@receivingX/ocr";
import { createDownloadUrl, createUploadUrl, getObjectBuffer, packagePhotoKey } from "@receivingX/storage";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { protectedProcedure, roleProcedure, router } from "../index";
import { generatePackagePublicId } from "../lib/publicId";
import { sendSessionNotifications } from "../lib/notify";

const receiverWrite = roleProcedure("receiver", "admin");

async function recomputeLineStatus(db: typeof import("@receivingX/db").default, lineId: string) {
  const line = await db.salesOrderLine.findUniqueOrThrow({ where: { id: lineId } });
  const agg = await db.package.aggregate({
    where: { salesOrderLineId: lineId, status: { in: ["CHECKED_IN"] } },
    _sum: { qtyReceived: true },
  });
  const qtyReceived = agg._sum.qtyReceived ?? 0;
  const status = qtyReceived <= 0 ? "OPEN" : qtyReceived >= line.qtyOrdered ? "RECEIVED" : "PARTIAL";
  await db.salesOrderLine.update({ where: { id: lineId }, data: { qtyReceived, status } });

  const order = await db.salesOrder.findUniqueOrThrow({ where: { id: line.salesOrderId }, include: { lines: true } });
  const allDone = order.lines.every((l) => l.status === "RECEIVED" || l.status === "CANCELLED");
  const anyProgress = order.lines.some((l) => l.status === "PARTIAL" || l.status === "RECEIVED");
  const orderStatus = allDone ? "CLOSED" : anyProgress ? "PARTIAL" : "OPEN";
  if (order.status !== "CANCELLED") {
    await db.salesOrder.update({ where: { id: order.id }, data: { status: orderStatus } });
  }
}

export const receivingRouter = router({
  session: router({
    current: protectedProcedure.query(({ ctx }) => {
      return ctx.db.receivingSession.findFirst({
        where: { receiverId: ctx.session.user.id, status: "DRAFT" },
        orderBy: { startedAt: "desc" },
      });
    }),

    start: receiverWrite.input(z.object({ locationId: z.string() })).mutation(({ ctx, input }) => {
      return ctx.db.receivingSession.create({
        data: { receiverId: ctx.session.user.id, locationId: input.locationId },
      });
    }),

    get: protectedProcedure.input(z.object({ id: z.string() })).query(({ ctx, input }) => {
      return ctx.db.receivingSession.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          receiver: true,
          location: true,
          notifications: true,
          packages: {
            where: { status: { not: "VOIDED" } },
            include: {
              photos: true,
              extractedFields: true,
              serials: true,
              salesOrderLine: { include: { salesOrder: { include: { customer: true } } } },
            },
            orderBy: { createdAt: "asc" },
          },
        },
      });
    }),

    list: protectedProcedure.query(({ ctx }) => {
      return ctx.db.receivingSession.findMany({
        orderBy: { startedAt: "desc" },
        take: 50,
        include: { receiver: true, location: true, _count: { select: { packages: true } } },
      });
    }),

    finish: receiverWrite.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
      const session = await ctx.db.receivingSession.findUniqueOrThrow({
        where: { id: input.id },
        include: { packages: { where: { status: { not: "VOIDED" } } } },
      });
      const pending = session.packages.filter((p) => p.status === "PENDING_OCR" || p.status === "NEEDS_REVIEW");
      if (pending.length > 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `${pending.length} package(s) still need review before finishing this session.`,
        });
      }
      if (session.packages.length === 0) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No packages checked in yet." });
      }

      await ctx.db.receivingSession.update({ where: { id: input.id }, data: { status: "FINALIZING" } });
      try {
        await sendSessionNotifications(ctx.db, input.id);
        return ctx.db.receivingSession.update({
          where: { id: input.id },
          data: { status: "SENT", finishedAt: new Date() },
        });
      } catch (err) {
        await ctx.db.receivingSession.update({ where: { id: input.id }, data: { status: "FAILED" } });
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: (err as Error).message });
      }
    }),

    cancel: receiverWrite.input(z.object({ id: z.string() })).mutation(({ ctx, input }) => {
      return ctx.db.receivingSession.delete({ where: { id: input.id, status: "DRAFT" } });
    }),
  }),

  package: router({
    create: receiverWrite.input(z.object({ sessionId: z.string() })).mutation(async ({ ctx, input }) => {
      const session = await ctx.db.receivingSession.findUniqueOrThrow({ where: { id: input.sessionId } });
      return ctx.db.package.create({
        data: {
          publicId: generatePackagePublicId(),
          sessionId: input.sessionId,
          locationId: session.locationId,
          receivedById: ctx.session.user.id,
        },
      });
    }),

    getByPublicId: protectedProcedure.input(z.object({ publicId: z.string() })).query(async ({ ctx, input }) => {
      const pkg = await ctx.db.package.findUniqueOrThrow({
        where: { publicId: input.publicId },
        include: {
          photos: true,
          serials: true,
          salesOrderLine: { include: { salesOrder: { include: { customer: true } }, vendor: true } },
        },
      });
      return pkg;
    }),

    get: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
      const pkg = await ctx.db.package.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          photos: {
            select: { id: true, kind: true, objectKey: true, mimeType: true, ocrStatus: true, createdAt: true },
          },
          extractedFields: true,
          serials: true,
          salesOrderLine: { include: { salesOrder: { include: { customer: true } }, vendor: true } },
        },
      });
      const photos = await Promise.all(
        pkg.photos.map(async (photo) => ({ ...photo, url: await createDownloadUrl(photo.objectKey) })),
      );
      return { ...pkg, photos };
    }),

    update: receiverWrite
      .input(
        z.object({
          id: z.string(),
          carrier: z.string().optional(),
          trackingNumber: z.string().optional(),
          shipFrom: z.string().optional(),
          shipToName: z.string().optional(),
          notes: z.string().optional(),
          qtyReceived: z.number().min(1).optional(),
        }),
      )
      .mutation(({ ctx, input }) => {
        const { id, ...data } = input;
        return ctx.db.package.update({ where: { id }, data });
      }),

    photoUploadUrl: receiverWrite
      .input(z.object({ packageId: z.string(), mimeType: z.string(), kind: z.enum(["LABEL", "PACKING_SLIP", "DAMAGE", "OTHER"]).default("LABEL") }))
      .mutation(async ({ input }) => {
        const photoId = crypto.randomUUID();
        const ext = input.mimeType.split("/")[1] ?? "jpg";
        const key = packagePhotoKey(input.packageId, photoId, ext);
        const uploadUrl = await createUploadUrl(key, input.mimeType);
        return { photoId, key, uploadUrl };
      }),

    confirmPhoto: receiverWrite
      .input(
        z.object({
          packageId: z.string(),
          objectKey: z.string(),
          mimeType: z.string(),
          bytes: z.number(),
          width: z.number().optional(),
          height: z.number().optional(),
          kind: z.enum(["LABEL", "PACKING_SLIP", "DAMAGE", "OTHER"]).default("LABEL"),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const photo = await ctx.db.packagePhoto.create({
          data: {
            packageId: input.packageId,
            objectKey: input.objectKey,
            mimeType: input.mimeType,
            bytes: input.bytes,
            width: input.width,
            height: input.height,
            kind: input.kind,
          },
        });
        await ctx.db.package.update({ where: { id: input.packageId }, data: { status: "PENDING_OCR" } });
        // Fire-and-continue: run OCR synchronously so the review screen has
        // fields as soon as the upload finishes. A queue (packages/jobs) is
        // the next step if this becomes a latency problem at real volume.
        await runOcrForPhoto(ctx.db, photo.id);
        return ctx.db.package.findUniqueOrThrow({
          where: { id: input.packageId },
          include: { photos: true, extractedFields: true },
        });
      }),

    reocr: receiverWrite.input(z.object({ photoId: z.string() })).mutation(async ({ ctx, input }) => {
      await runOcrForPhoto(ctx.db, input.photoId);
      const photo = await ctx.db.packagePhoto.findUniqueOrThrow({ where: { id: input.photoId } });
      return ctx.db.package.findUniqueOrThrow({
        where: { id: photo.packageId },
        include: { photos: true, extractedFields: true },
      });
    }),

    suggestMatches: protectedProcedure
      .input(z.object({ packageId: z.string(), search: z.string().optional() }))
      .query(async ({ ctx, input }) => {
        const fields = await ctx.db.extractedField.findMany({ where: { packageId: input.packageId } });
        const poCandidates = fields.filter((f) => f.key === "PO").map((f) => f.value);
        const pnCandidates = fields.filter((f) => f.key === "PN").map((f) => f.value);

        return ctx.db.salesOrderLine.findMany({
          where: {
            status: { in: ["OPEN", "PARTIAL"] },
            OR: [
              poCandidates.length ? { poNumber: { in: poCandidates } } : undefined,
              pnCandidates.length ? { partNumber: { in: pnCandidates } } : undefined,
              input.search
                ? {
                    OR: [
                      { poNumber: { contains: input.search, mode: "insensitive" } },
                      { partNumber: { contains: input.search, mode: "insensitive" } },
                      { salesOrder: { soNumber: { contains: input.search, mode: "insensitive" } } },
                      { salesOrder: { customer: { name: { contains: input.search, mode: "insensitive" } } } },
                    ],
                  }
                : undefined,
            ].filter(Boolean) as object[],
          },
          include: { salesOrder: { include: { customer: true } }, vendor: true },
          take: 20,
        });
      }),

    link: receiverWrite
      .input(z.object({ packageId: z.string(), salesOrderLineId: z.string().nullable() }))
      .mutation(async ({ ctx, input }) => {
        const pkg = await ctx.db.package.update({
          where: { id: input.packageId },
          data: {
            salesOrderLineId: input.salesOrderLineId,
            status: input.salesOrderLineId ? "MATCHED" : "UNMATCHED",
          },
        });
        if (pkg.status === "CHECKED_IN" && input.salesOrderLineId) {
          await recomputeLineStatus(ctx.db, input.salesOrderLineId);
        }
        return pkg;
      }),

    checkIn: receiverWrite
      .input(
        z.object({
          packageId: z.string(),
          salesOrderLineId: z.string().nullable(),
          qtyReceived: z.number().min(1).default(1),
          serials: z.array(z.string()).default([]),
          carrier: z.string().optional(),
          trackingNumber: z.string().optional(),
          shipFrom: z.string().optional(),
          shipToName: z.string().optional(),
          notes: z.string().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const status = input.salesOrderLineId ? "CHECKED_IN" : "UNMATCHED";

        await ctx.db.$transaction([
          ctx.db.package.update({
            where: { id: input.packageId },
            data: {
              salesOrderLineId: input.salesOrderLineId,
              qtyReceived: input.qtyReceived,
              carrier: input.carrier,
              trackingNumber: input.trackingNumber,
              shipFrom: input.shipFrom,
              shipToName: input.shipToName,
              notes: input.notes,
              status,
            },
          }),
          ctx.db.serialNumber.createMany({
            data: input.serials.map((serial) => ({
              packageId: input.packageId,
              salesOrderLineId: input.salesOrderLineId,
              serial,
            })),
            skipDuplicates: true,
          }),
        ]);

        if (input.salesOrderLineId) {
          await recomputeLineStatus(ctx.db, input.salesOrderLineId);
        }

        // InvenTree sync - non-fatal. See packages/inventree checkInToInventree.
        if (input.salesOrderLineId) {
          const line = await ctx.db.salesOrderLine.findUnique({ where: { id: input.salesOrderLineId } });
          if (line) {
            const result = await checkInToInventree({
              partNumber: line.partNumber,
              description: line.description ?? line.partNumber,
              quantity: input.qtyReceived,
              serial: input.serials[0],
              notes: `ReceivingX package ${input.packageId}`,
            });
            if (result.ok) {
              await ctx.db.package.update({
                where: { id: input.packageId },
                data: { inventreeStockItemId: result.stockItemId, inventreeUrl: result.url },
              });
            }
          }
        }

        return ctx.db.package.findUniqueOrThrow({
          where: { id: input.packageId },
          include: { serials: true, salesOrderLine: true },
        });
      }),

    void: receiverWrite.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
      const pkg = await ctx.db.package.update({ where: { id: input.id }, data: { status: "VOIDED" } });
      if (pkg.salesOrderLineId) await recomputeLineStatus(ctx.db, pkg.salesOrderLineId);
      return pkg;
    }),
  }),
});

async function runOcrForPhoto(db: typeof import("@receivingX/db").default, photoId: string): Promise<void> {
  const photo = await db.packagePhoto.findUniqueOrThrow({ where: { id: photoId } });
  await db.packagePhoto.update({ where: { id: photoId }, data: { ocrStatus: "PROCESSING" } });

  try {
    const buffer = await getObjectBuffer(photo.objectKey);
    const result = await runOcr({ buffer, filename: photo.objectKey, mimeType: photo.mimeType });

    const openLines = await db.salesOrderLine.findMany({
      where: { status: { in: ["OPEN", "PARTIAL"] } },
      select: { poNumber: true, partNumber: true },
    });

    const candidates = extractFieldsFromText(result.rawText, {
      openPoNumbers: openLines.map((l) => l.poNumber),
      openPartNumbers: openLines.map((l) => l.partNumber),
    });

    await db.packagePhoto.update({
      where: { id: photoId },
      data: {
        ocrStatus: "DONE",
        ocrRawText: result.rawText,
        ocrBlocks: result.blocks as unknown as object,
        ocrConfidence: candidates[0]?.confidence,
      },
    });

    if (candidates.length > 0) {
      await db.extractedField.createMany({
        data: candidates.map((c) => ({
          packageId: photo.packageId,
          key: c.key,
          value: c.value,
          confidence: c.confidence,
          source: "OCR" as const,
        })),
      });
    }

    // Auto-match: exactly one open line whose PO matches a high-confidence candidate.
    const poGuess = candidates.find((c) => c.key === "PO" && c.confidence >= 0.9);
    let matchedLineId: string | null = null;
    if (poGuess) {
      const matches = await db.salesOrderLine.findMany({
        where: { poNumber: poGuess.value, status: { in: ["OPEN", "PARTIAL"] } },
      });
      if (matches.length === 1 && matches[0]) matchedLineId = matches[0].id;
    }

    await db.package.update({
      where: { id: photo.packageId },
      data: {
        salesOrderLineId: matchedLineId,
        status: matchedLineId ? "MATCHED" : "NEEDS_REVIEW",
      },
    });
  } catch (err) {
    await db.packagePhoto.update({
      where: { id: photoId },
      data: { ocrStatus: "FAILED", ocrRawText: (err as Error).message },
    });
    await db.package.update({ where: { id: photo.packageId }, data: { status: "NEEDS_REVIEW" } });
  }
}

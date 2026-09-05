import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { protectedProcedure, roleProcedure, router } from "../index";
import { parseOrdersWorkbook } from "../lib/importParser";

const orderStatus = z.enum(["OPEN", "PARTIAL", "CLOSED", "CANCELLED"]);

export const ordersRouter = router({
  list: protectedProcedure
    .input(
      z
        .object({
          status: orderStatus.optional(),
          search: z.string().optional(),
          customerId: z.string().optional(),
        })
        .optional(),
    )
    .query(({ ctx, input }) => {
      return ctx.db.salesOrder.findMany({
        where: {
          status: input?.status,
          customerId: input?.customerId,
          ...(input?.search
            ? {
                OR: [
                  { soNumber: { contains: input.search, mode: "insensitive" } },
                  { customer: { name: { contains: input.search, mode: "insensitive" } } },
                  { lines: { some: { poNumber: { contains: input.search, mode: "insensitive" } } } },
                  { lines: { some: { partNumber: { contains: input.search, mode: "insensitive" } } } },
                ],
              }
            : {}),
        },
        include: { customer: true, salesRep: true, lines: { include: { vendor: true, serials: true } } },
        orderBy: { orderDate: "desc" },
      });
    }),

  get: protectedProcedure.input(z.object({ id: z.string() })).query(({ ctx, input }) => {
    return ctx.db.salesOrder.findUniqueOrThrow({
      where: { id: input.id },
      include: {
        customer: true,
        salesRep: true,
        location: true,
        lines: { include: { vendor: true, serials: true, packages: true } },
      },
    });
  }),

  create: roleProcedure("sales", "admin")
    .input(
      z.object({
        soNumber: z.string().min(1),
        customerId: z.string(),
        salesRepId: z.string().optional(),
        orderDate: z.coerce.date(),
        locationId: z.string(),
        notes: z.string().optional(),
        lines: z
          .array(
            z.object({
              lineNo: z.number().default(1),
              vendorId: z.string().optional(),
              poNumber: z.string().min(1),
              qtyOrdered: z.number().min(1),
              partNumber: z.string().min(1),
              description: z.string().optional(),
              eta: z.coerce.date().optional(),
            }),
          )
          .default([]),
      }),
    )
    .mutation(({ ctx, input }) => {
      const { lines, ...order } = input;
      return ctx.db.salesOrder.create({
        data: { ...order, lines: { create: lines } },
        include: { lines: true },
      });
    }),

  update: roleProcedure("sales", "admin")
    .input(
      z.object({
        id: z.string(),
        salesRepId: z.string().optional(),
        notes: z.string().optional(),
        status: orderStatus.optional(),
      }),
    )
    .mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.salesOrder.update({ where: { id }, data });
    }),

  close: roleProcedure("sales", "admin").input(z.object({ id: z.string() })).mutation(({ ctx, input }) => {
    return ctx.db.salesOrder.update({ where: { id: input.id }, data: { status: "CLOSED" } });
  }),

  lines: router({
    create: roleProcedure("sales", "admin")
      .input(
        z.object({
          salesOrderId: z.string(),
          lineNo: z.number().default(1),
          vendorId: z.string().optional(),
          poNumber: z.string().min(1),
          qtyOrdered: z.number().min(1),
          partNumber: z.string().min(1),
          description: z.string().optional(),
          eta: z.coerce.date().optional(),
        }),
      )
      .mutation(({ ctx, input }) => {
        return ctx.db.salesOrderLine.create({ data: input });
      }),

    update: roleProcedure("sales", "admin")
      .input(
        z.object({
          id: z.string(),
          vendorId: z.string().optional(),
          poNumber: z.string().optional(),
          qtyOrdered: z.number().optional(),
          partNumber: z.string().optional(),
          description: z.string().optional(),
          eta: z.coerce.date().nullable().optional(),
          status: z.enum(["OPEN", "PARTIAL", "RECEIVED", "CANCELLED"]).optional(),
        }),
      )
      .mutation(({ ctx, input }) => {
        const { id, ...data } = input;
        return ctx.db.salesOrderLine.update({ where: { id }, data });
      }),

    delete: roleProcedure("sales", "admin").input(z.object({ id: z.string() })).mutation(({ ctx, input }) => {
      return ctx.db.salesOrderLine.delete({ where: { id: input.id } });
    }),
  }),

  import: router({
    preview: roleProcedure("sales", "admin")
      .input(z.object({ fileBase64: z.string() }))
      .mutation(({ input }) => {
        const buffer = Buffer.from(input.fileBase64, "base64");
        const rows = parseOrdersWorkbook(buffer);
        const okRows = rows.filter((r) => r.errors.length === 0);
        return {
          rows,
          summary: {
            total: rows.length,
            ok: okRows.length,
            errors: rows.length - okRows.length,
            distinctOrders: new Set(okRows.map((r) => r.soNumber)).size,
            distinctCustomers: new Set(okRows.map((r) => r.customer)).size,
          },
        };
      }),

    commit: roleProcedure("sales", "admin")
      .input(z.object({ fileBase64: z.string(), filename: z.string(), locationId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.session) throw new TRPCError({ code: "UNAUTHORIZED" });
        const buffer = Buffer.from(input.fileBase64, "base64");
        const rows = parseOrdersWorkbook(buffer);
        const okRows = rows.filter((r) => r.errors.length === 0);

        // One synthetic session holds every historical "already received" row
        // from this import, per docs/PLAN.md section 5.C.
        const importSession = await ctx.db.receivingSession.create({
          data: {
            receiverId: ctx.session.user.id,
            locationId: input.locationId,
            status: "SENT",
            finishedAt: new Date(),
          },
        });

        let okCount = 0;
        const errors: { row: number; message: string }[] = [];

        for (const row of okRows) {
          try {
            const customer =
              (await ctx.db.customer.findFirst({ where: { name: row.customer } })) ??
              (await ctx.db.customer.create({ data: { name: row.customer } }));

            const vendor = row.vendor
              ? await ctx.db.vendor.upsert({
                  where: { name: row.vendor },
                  create: { name: row.vendor },
                  update: {},
                })
              : null;

            const order = await ctx.db.salesOrder.upsert({
              where: { soNumber: row.soNumber },
              create: {
                soNumber: row.soNumber,
                customerId: customer.id,
                orderDate: row.orderDate ? new Date(row.orderDate) : new Date(),
                locationId: input.locationId,
              },
              update: {},
            });

            const isReceived = Boolean(row.receivedDate);
            const line = await ctx.db.salesOrderLine.create({
              data: {
                salesOrderId: order.id,
                vendorId: vendor?.id,
                poNumber: row.po,
                qtyOrdered: row.qty,
                partNumber: row.pn,
                description: row.description || null,
                eta: row.eta ? new Date(row.eta) : null,
                qtyReceived: isReceived ? row.qty : 0,
                status: isReceived ? "RECEIVED" : "OPEN",
              },
            });

            if (isReceived) {
              const pkg = await ctx.db.package.create({
                data: {
                  publicId: `IMP-${order.soNumber}-${line.id.slice(-6)}`,
                  sessionId: importSession.id,
                  locationId: input.locationId,
                  receivedAt: new Date(row.receivedDate!),
                  receivedById: ctx.session.user.id,
                  status: "CHECKED_IN",
                  salesOrderLineId: line.id,
                  qtyReceived: row.qty,
                  imported: true,
                },
              });
              if (row.serials.length > 0) {
                await ctx.db.serialNumber.createMany({
                  data: row.serials.map((serial) => ({ packageId: pkg.id, salesOrderLineId: line.id, serial })),
                  skipDuplicates: true,
                });
              }
            }

            okCount++;
          } catch (err) {
            errors.push({ row: row.rowIndex, message: (err as Error).message });
          }
        }

        const batch = await ctx.db.importBatch.create({
          data: {
            filename: input.filename,
            importedById: ctx.session.user.id,
            rowCount: rows.length,
            okCount,
            errorCount: rows.length - okCount,
            report: { errors, parseErrors: rows.filter((r) => r.errors.length > 0) } as object,
          },
        });

        return {
          id: batch.id,
          filename: batch.filename,
          rowCount: batch.rowCount,
          okCount: batch.okCount,
          errorCount: batch.errorCount,
        };
      }),
  }),
});

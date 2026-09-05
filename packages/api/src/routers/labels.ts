import { env } from "@receivingX/env/server";
import { z } from "zod";

import { protectedProcedure, roleProcedure, router } from "../index";
import { renderLabelPdf } from "../lib/labels";

export const labelsRouter = router({
  render: protectedProcedure
    .input(z.object({ packageId: z.string(), format: z.enum(["thermal", "office"]).default("thermal") }))
    .mutation(async ({ ctx, input }) => {
      const pkg = await ctx.db.package.findUniqueOrThrow({
        where: { id: input.packageId },
        include: { salesOrderLine: { include: { salesOrder: { include: { customer: true } } } } },
      });

      const pdfBytes = await renderLabelPdf(
        {
          publicId: pkg.publicId,
          po: pkg.salesOrderLine?.poNumber ?? "-",
          pn: pkg.salesOrderLine?.partNumber ?? "-",
          qty: pkg.qtyReceived,
          customer: pkg.salesOrderLine?.salesOrder.customer.name ?? "Unmatched",
          description: pkg.salesOrderLine?.description ?? undefined,
          date: new Date(pkg.receivedAt).toLocaleDateString(),
          qrUrl: `${env.APP_URL}/p/${pkg.publicId}`,
          inventreeRef: pkg.inventreeStockItemId ?? undefined,
        },
        input.format,
      );

      return { pdfBase64: Buffer.from(pdfBytes).toString("base64") };
    }),

  markPrinted: roleProcedure("receiver", "admin").input(z.object({ packageId: z.string() })).mutation(({ ctx, input }) => {
    return ctx.db.package.update({ where: { id: input.packageId }, data: { labelPrintedAt: new Date() } });
  }),
});

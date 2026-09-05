import * as XLSX from "xlsx";

import { protectedProcedure, router } from "../index";

async function stockRows(db: (typeof import("@receivingX/db"))["default"]) {
  const lines = await db.salesOrderLine.findMany({
    include: {
      vendor: true,
      serials: true,
      salesOrder: { include: { customer: true } },
      packages: { where: { status: "CHECKED_IN" } },
    },
    orderBy: { createdAt: "desc" },
  });

  return lines.map((line) => ({
    Customer: line.salesOrder.customer.name,
    "Order Date": new Date(line.salesOrder.orderDate).toLocaleDateString(),
    Vendor: line.vendor?.name ?? "",
    PO: line.poNumber,
    Qty: line.qtyOrdered,
    PN: line.partNumber,
    Description: line.description ?? "",
    SN: line.serials.map((s) => s.serial).join(", "),
    Received: line.packages[0] ? new Date(line.packages[0].receivedAt).toLocaleDateString() : "",
    ETA: line.eta ? new Date(line.eta).toLocaleDateString() : "",
  }));
}

export const reportsRouter = router({
  stock: protectedProcedure.query(async ({ ctx }) => {
    return stockRows(ctx.db);
  }),

  dashboardStats: protectedProcedure.query(async ({ ctx }) => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [receivedToday, openOrders, needsReview, receivedThisMonth] = await Promise.all([
      ctx.db.package.count({ where: { status: "CHECKED_IN", receivedAt: { gte: startOfDay } } }),
      ctx.db.salesOrder.count({ where: { status: { in: ["OPEN", "PARTIAL"] } } }),
      ctx.db.package.count({ where: { status: "NEEDS_REVIEW" } }),
      ctx.db.package.count({ where: { status: "CHECKED_IN", receivedAt: { gte: startOfMonth } } }),
    ]);

    return { receivedToday, openOrders, needsReview, receivedThisMonth };
  }),

  exportCsv: protectedProcedure.query(async ({ ctx }) => {
    const rows = await stockRows(ctx.db);
    const sheet = XLSX.utils.json_to_sheet(rows);
    return { csv: XLSX.utils.sheet_to_csv(sheet) };
  }),

  exportXlsx: protectedProcedure.query(async ({ ctx }) => {
    const rows = await stockRows(ctx.db);
    const sheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Stock");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
    return { base64: buffer.toString("base64") };
  }),
});

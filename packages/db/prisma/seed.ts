/**
 * Seeds demo data matching the two example rows from ReceivingX.md so the
 * app isn't empty on first run. Does NOT create any users - sign up through
 * the web app, then run `bun run db:promote-admin -- you@example.com` to
 * grant yourself the admin role.
 */
import { createPrismaClient } from "../src/index";

const prisma = createPrismaClient();

async function main() {
  const location = await prisma.location.upsert({
    where: { code: "MAIN" },
    create: {
      name: "Main Office",
      code: "MAIN",
      isDefault: true,
    },
    update: {},
  });

  const customer = await prisma.customer.upsert({
    where: { id: "seed-customer-williams" },
    create: { id: "seed-customer-williams", name: "Williams Express #2" },
    update: {},
  });

  const scanSource = await prisma.vendor.upsert({
    where: { name: "ScanSource" },
    create: { name: "ScanSource" },
    update: {},
  });
  const trintas = await prisma.vendor.upsert({
    where: { name: "TRINTAS" },
    create: { name: "TRINTAS" },
    update: {},
  });

  const order1 = await prisma.salesOrder.upsert({
    where: { soNumber: "SEED-001" },
    create: {
      soNumber: "SEED-001",
      customerId: customer.id,
      orderDate: new Date("2026-08-11"),
      locationId: location.id,
      status: "CLOSED",
    },
    update: {},
  });

  await prisma.salesOrderLine.upsert({
    where: { id: "seed-line-1" },
    create: {
      id: "seed-line-1",
      salesOrderId: order1.id,
      vendorId: scanSource.id,
      poNumber: "705895",
      qtyOrdered: 2,
      qtyReceived: 2,
      partNumber: "CE0A5UP#ABA",
      description: 'HP Engage Pro G2 15.6" Landscape WIN 11 IOT i3, 16GB 256 (With Stand)',
      eta: new Date("2026-09-09"),
      status: "RECEIVED",
    },
    update: {},
  });

  const order2 = await prisma.salesOrder.upsert({
    where: { soNumber: "126575" },
    create: {
      soNumber: "126575",
      customerId: customer.id,
      orderDate: new Date("2026-08-25"),
      locationId: location.id,
      status: "OPEN",
    },
    update: {},
  });

  await prisma.salesOrderLine.upsert({
    where: { id: "seed-line-2" },
    create: {
      id: "seed-line-2",
      salesOrderId: order2.id,
      vendorId: trintas.id,
      poNumber: "705935",
      qtyOrdered: 2,
      partNumber: "M445-403-01-WWA-5 (T)",
      description: "VERIFONE M400 WIFI BLUETOOTH",
      status: "OPEN",
    },
    update: {},
  });

  console.log("Seeded:", { location: location.code, customers: 1, orders: 2 });
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

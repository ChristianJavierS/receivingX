/** Usage: bun run db:promote-admin -- you@example.com */
import { createPrismaClient } from "../src/index";

const prisma = createPrismaClient();

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: bun run db:promote-admin -- you@example.com");
    process.exit(1);
  }
  const user = await prisma.user.update({
    where: { email },
    data: { role: "admin", active: true },
  });
  console.log(`Promoted ${user.email} to admin.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

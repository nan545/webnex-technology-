import "dotenv/config";
import { prisma } from "../src/server/db";

async function main() {
  await prisma.$queryRaw`SELECT 1`;
  console.log("PostgreSQL connection verified.");
}

main()
  .catch((error: unknown) => {
    console.error("PostgreSQL connection check failed.");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

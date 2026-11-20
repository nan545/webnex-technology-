import { dispatchEmailOutbox } from "../src/server/integrations/email-outbox";
import { prisma } from "../src/server/db";

async function main() {
  const counts = await dispatchEmailOutbox();
  console.log("SendGrid outbox run complete.", counts);
}

main()
  .catch((error: unknown) => {
    console.error("SendGrid outbox run failed.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

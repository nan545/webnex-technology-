import { dispatchEmailOutbox } from "../src/server/integrations/email-outbox";
import { dispatchWorkAssignmentEmails } from "../src/server/integrations/work-assignment-email";
import { prisma } from "../src/server/db";

async function main() {
  const counts = await dispatchEmailOutbox();
  console.log("SendGrid outbox run complete.", counts);
  const assignmentCounts = await dispatchWorkAssignmentEmails();
  console.log("Work assignment email run complete.", assignmentCounts);
}

main()
  .catch((error: unknown) => {
    console.error("SendGrid outbox run failed.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

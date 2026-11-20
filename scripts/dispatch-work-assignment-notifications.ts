import { dispatchWorkAssignmentNotifications } from "../src/server/integrations/work-assignment-notifications";
import { prisma } from "../src/server/db";

async function main() {
  const counts = await dispatchWorkAssignmentNotifications();
  console.log("Work assignment message run complete.", counts);
}

main()
  .catch((error: unknown) => {
    console.error("Work assignment message run failed.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

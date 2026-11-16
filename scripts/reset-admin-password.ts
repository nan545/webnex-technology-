import "dotenv/config";
import { env } from "../src/server/env";
import { resetAdminPassword } from "../src/server/auth/admin-password-reset";
import { prisma } from "../src/server/db";
import { prompt, promptPassword } from "./interactive-input";

async function main() {
  if (!process.stdin.isTTY) throw new Error("Run this command from an interactive terminal.");

  const database = new URL(env.DATABASE_URL);
  console.log(`Database host: ${database.host}\nDatabase name: ${database.pathname.slice(1)}`);
  const email = await prompt("Existing administrator email: ");
  const password = await promptPassword("New password (min 12 characters): ");
  const confirmation = await promptPassword("Confirm new password: ");
  if (password !== confirmation) throw new Error("Passwords do not match.");
  const approval = await prompt("Confirm this database and account; type RESET to continue: ");
  if (approval !== "RESET") throw new Error("Password reset cancelled.");

  await resetAdminPassword({ email, password });
  console.log("Administrator password reset. Existing sessions have been invalidated.");
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Administrator password reset failed.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

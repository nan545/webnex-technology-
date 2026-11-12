import "dotenv/config";
import { emitKeypressEvents } from "node:readline";
import { createInterface } from "node:readline/promises";
import { hash } from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "../src/server/env";
import { z } from "zod";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
});

function prompt(label: string) {
  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  return terminal.question(label).finally(() => terminal.close());
}

async function promptPassword(label: string) {
  if (!process.stdin.isTTY || !process.stdin.setRawMode) {
    throw new Error("Run this command from an interactive terminal.");
  }
  process.stdout.write(label);
  emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.resume();

  return new Promise<string>((resolve, reject) => {
    let value = "";
    const onKeypress = (text: string, key: { name?: string; ctrl?: boolean }) => {
      if (key.ctrl && key.name === "c") {
        process.stdin.off("keypress", onKeypress);
        process.stdin.setRawMode(false);
        reject(new Error("Bootstrap cancelled."));
      } else if (key.name === "return" || key.name === "enter") {
        process.stdin.off("keypress", onKeypress);
        process.stdin.setRawMode(false);
        process.stdout.write("\n");
        resolve(value);
      } else if (key.name === "backspace") {
        value = value.slice(0, -1);
      } else if (!key.ctrl && text && text.length === 1 && text >= " ") {
        value += text;
      }
    };
    process.stdin.on("keypress", onKeypress);
  });
}

async function main() {
  if (!process.stdin.isTTY) {
    throw new Error("Run this command from an interactive terminal.");
  }

  const name = (await prompt("Super Admin name: ")).trim();
  const email = (await prompt("Super Admin email: ")).trim().toLowerCase();
  const password = await promptPassword("Password (min 12 characters): ");
  const confirmation = await promptPassword("Confirm password: ");
  const parsed = z
    .object({
      name: z.string().min(2).max(120),
      email: z.string().email().max(254),
      password: z
        .string()
        .min(12)
        .max(72)
        .refine((value) => Buffer.byteLength(value, "utf8") <= 72),
    })
    .safeParse({ name, email, password });

  if (!parsed.success) {
    throw new Error("Enter a valid name and email, and a password of 12–72 UTF-8 bytes.");
  }
  if (password !== confirmation) throw new Error("Passwords do not match.");

  const passwordHash = await hash(password, 12);
  await prisma.$transaction(
    async (transaction) => {
      await transaction.$queryRaw`SELECT pg_advisory_xact_lock(72340172838076673)`;
      const superAdminRole = await transaction.role.findUnique({
        where: { key: "SUPER_ADMIN" },
        select: { id: true },
      });
      if (!superAdminRole) {
        throw new Error("Roles are not seeded. Run npm run db:seed first.");
      }
      const existingSuperAdmin = await transaction.userRole.findFirst({
        where: { roleId: superAdminRole.id, user: { isActive: true } },
        select: { userId: true },
      });
      if (existingSuperAdmin) {
        throw new Error("An active Super Admin already exists; bootstrap is disabled.");
      }
      const existingUser = await transaction.user.findUnique({
        where: { email },
        select: { id: true },
      });
      if (existingUser) throw new Error("That email already belongs to an account.");

      const user = await transaction.user.create({
        data: {
          name,
          email,
          passwordHash,
          emailVerified: new Date(),
          roles: { create: { roleId: superAdminRole.id } },
        },
        select: { id: true },
      });
      await transaction.auditLog.create({
        data: {
          actorId: user.id,
          action: "USER_BOOTSTRAPPED",
          entityType: "User",
          entityId: user.id,
          details: { role: "SUPER_ADMIN" },
        },
      });
    },
    { isolationLevel: "Serializable" },
  );
  console.log("The initial Super Admin account was created.");
}

main()
  .catch((error: unknown) => {
    console.error(
      error instanceof Error ? error.message : "Super Admin bootstrap failed.",
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

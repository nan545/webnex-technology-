import "server-only";
import { hash } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/server/db";

export const adminNewPasswordSchema = z.string().min(12).max(72)
  .refine((value) => Buffer.byteLength(value, "utf8") <= 72);

const resetInputSchema = z.object({
  email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
  password: adminNewPasswordSchema,
}).strict();

export async function resetOtherAdminPassword(actorId: string, userId: string, password: string) {
  if (actorId === userId || !adminNewPasswordSchema.safeParse(password).success) {
    throw new Error("Invalid administrator password reset.");
  }
  const passwordHash = await hash(password, 12);
  return prisma.$transaction(async (transaction) => {
    const result = await transaction.user.updateMany({
      where: { id: userId, isActive: true, roles: { some: {} } },
      data: {
        passwordHash,
        failedLoginAttempts: 0,
        lockedUntil: null,
        sessionVersion: { increment: 1 },
      },
    });
    if (result.count === 0) return false;
    await transaction.auditLog.create({
      data: {
        actorId,
        action: "ADMIN_PASSWORD_RESET",
        entityType: "User",
        entityId: userId,
        details: { method: "dashboard" },
      },
    });
    return true;
  });
}

export async function resetAdminPassword(input: { email: string; password: string }) {
  const parsed = resetInputSchema.safeParse(input);
  if (!parsed.success) throw new Error("Enter a valid email and a password of 12-72 UTF-8 bytes.");

  const passwordHash = await hash(parsed.data.password, 12);
  await prisma.$transaction(async (transaction) => {
    const users = await transaction.user.findMany({
      where: {
        email: { equals: parsed.data.email, mode: "insensitive" },
        isActive: true,
        roles: { some: {} },
      },
      select: { id: true },
      take: 2,
    });
    const user = users[0];
    if (users.length !== 1 || !user) {
      throw new Error("A unique active administrator with that email was not found.");
    }

    await transaction.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        sessionVersion: { increment: 1 },
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
    await transaction.auditLog.create({
      data: {
        action: "ADMIN_PASSWORD_RESET",
        entityType: "User",
        entityId: user.id,
        details: { method: "trusted-database-cli" },
      },
    });
  }, { maxWait: 20_000, timeout: 30_000 });
}

import { compare } from "bcryptjs";
import { z } from "zod";
import { readBoundedJson } from "@/server/api/bounded-json";
import { apiError, apiSuccess, handleApiFailure } from "@/server/api/response";
import { authorizeSuperAdmin } from "@/server/auth/admin-api";
import { adminNewPasswordSchema, resetOtherAdminPassword } from "@/server/auth/admin-password-reset";
import { prisma } from "@/server/db";
import { consumeLoginRateLimit } from "@/server/security/auth-rate-limit";
import { rejectCrossOriginMutation } from "@/server/security/same-origin";

const passwordSchema = z.string().min(1).max(72)
  .refine((value) => Buffer.byteLength(value, "utf8") <= 72);
const resetSchema = z.object({
  currentPassword: passwordSchema,
  newPassword: adminNewPasswordSchema,
}).strict();

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const originError = rejectCrossOriginMutation(request);
  if (originError) return originError;
  const authorization = await authorizeSuperAdmin("users:manage");
  if (authorization.response) return authorization.response;
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return apiError(404, "NOT_FOUND", "Administrator was not found.");
  if (id === authorization.admin.id) return apiError(403, "SELF_RESET", "Use another Super Admin account to reset your password.");
  const body = await readBoundedJson(request);
  if (body.error) return body.error;
  const input = resetSchema.safeParse(body.value);
  if (!input.success) return apiError(422, "VALIDATION_FAILED", "Enter your current password and a new password of 12–72 UTF-8 bytes.");

  try {
    const address = request.headers.get("x-real-ip")?.trim() || "unknown";
    const limit = await consumeLoginRateLimit(authorization.admin.email, address);
    if (!limit.allowed) return apiError(429, "RATE_LIMITED", "Too many attempts. Try again later.");
    const actor = await prisma.user.findUnique({
      where: { id: authorization.admin.id },
      select: { passwordHash: true, isActive: true },
    });
    if (!actor?.isActive || !actor.passwordHash || !await compare(input.data.currentPassword, actor.passwordHash)) {
      return apiError(403, "REAUTH_FAILED", "Your current password could not be verified.");
    }

    const updated = await resetOtherAdminPassword(authorization.admin.id, id, input.data.newPassword);
    return updated
      ? apiSuccess({ reset: true })
      : apiError(404, "NOT_FOUND", "An active administrator was not found.");
  } catch (error) {
    return handleApiFailure(error);
  }
}

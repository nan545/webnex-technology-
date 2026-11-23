import { Prisma } from "@/generated/prisma/client";
import { z } from "zod";
import { contactPhoneSchema } from "@/lib/validation/contact-phone";
import { roleKeySchema } from "@/lib/validation/roles";
import { readBoundedJson } from "@/server/api/bounded-json";
import { apiError, apiSuccess, handleApiFailure } from "@/server/api/response";
import { authorizeSuperAdmin } from "@/server/auth/admin-api";
import { prisma, runInTransaction } from "@/server/db";
import { rejectCrossOriginMutation } from "@/server/security/same-origin";

const updateSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    phone: contactPhoneSchema.optional(),
    smsAlertsEnabled: z.boolean().optional(),
    whatsappAlertsEnabled: z.boolean().optional(),
    isActive: z.boolean().optional(),
    roleKey: roleKeySchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0);

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const originError = rejectCrossOriginMutation(request);
  if (originError) return originError;
  const authorization = await authorizeSuperAdmin("users:manage");
  if (authorization.response) return authorization.response;
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return apiError(404, "NOT_FOUND", "Administrator was not found.");

  const body = await readBoundedJson(request);
  if (body.error) return body.error;
  const input = updateSchema.safeParse(body.value);
  if (!input.success) return apiError(422, "VALIDATION_FAILED", "Administrator changes are invalid.");
  if (
    id === authorization.admin!.id &&
    (input.data.isActive === false || input.data.roleKey !== undefined)
  ) {
    return apiError(409, "SELF_PROTECTION", "You cannot deactivate or change the role of your own account.");
  }
  if (
    input.data.roleKey === "SUPER_ADMIN" &&
    !authorization.admin!.roles.includes("SUPER_ADMIN")
  ) {
    return apiError(403, "FORBIDDEN", "Only a Super Admin can assign that role.");
  }

  try {
    const user = await runInTransaction(
      async (transaction) => {
        await transaction.$executeRaw`SELECT pg_advisory_xact_lock(72340172838076673)`;
        const existing = await transaction.user.findUnique({
          where: { id },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            smsAlertsEnabled: true,
            whatsappAlertsEnabled: true,
            smsConsentAt: true,
            whatsappConsentAt: true,
            isActive: true,
            roles: { select: { role: { select: { id: true, key: true } } } },
          },
        });
        if (!existing) return null;

        const phone = input.data.phone !== undefined ? input.data.phone : existing.phone;
        const smsAlertsEnabled = input.data.smsAlertsEnabled ?? existing.smsAlertsEnabled;
        const whatsappAlertsEnabled = input.data.whatsappAlertsEnabled ?? existing.whatsappAlertsEnabled;
        const smsConsentAt = input.data.smsAlertsEnabled
          ? (input.data.smsAlertsEnabled ? (existing.smsConsentAt ?? new Date()) : null)
          : existing.smsConsentAt;
        const whatsappConsentAt = input.data.whatsappAlertsEnabled
          ? (input.data.whatsappAlertsEnabled ? (existing.whatsappConsentAt ?? new Date()) : null)
          : existing.whatsappConsentAt;
        if ((smsAlertsEnabled || whatsappAlertsEnabled) && !phone) return { invalidContact: true } as const;

        const currentRole = existing.roles[0]?.role;
        const hasSuperAdminRole = existing.roles.some(({ role }) => role.key === "SUPER_ADMIN");
        const changesSuperAdmin =
          hasSuperAdminRole &&
          (input.data.roleKey !== undefined && input.data.roleKey !== "SUPER_ADMIN" ||
            input.data.isActive === false);

        if (changesSuperAdmin) {
          const activeSuperAdmins = await transaction.userRole.count({
            where: {
              role: { key: "SUPER_ADMIN" },
              user: { isActive: true },
            },
          });
          if (activeSuperAdmins <= 1) {
            throw new LastSuperAdminError();
          }
        }

        const role = input.data.roleKey
          ? await transaction.role.findUnique({
              where: { key: input.data.roleKey },
              select: { id: true, key: true },
            })
          : null;
        if (input.data.roleKey && !role) throw new InvalidRoleError();

        const roleChanged =
          input.data.roleKey !== undefined && input.data.roleKey !== currentRole?.key;
        const updated = await transaction.user.update({
          where: { id },
          data: {
            ...(input.data.name !== undefined ? { name: input.data.name } : {}),
            ...(input.data.phone !== undefined ? { phone: input.data.phone } : {}),
            ...(input.data.smsAlertsEnabled !== undefined ? { smsAlertsEnabled: input.data.smsAlertsEnabled } : {}),
            ...(input.data.whatsappAlertsEnabled !== undefined ? { whatsappAlertsEnabled: input.data.whatsappAlertsEnabled } : {}),
            ...(input.data.smsAlertsEnabled !== undefined
              ? { smsConsentAt: smsConsentAt }
              : {}),
            ...(input.data.whatsappAlertsEnabled !== undefined
              ? { whatsappConsentAt: whatsappConsentAt }
              : {}),
            ...(input.data.isActive !== undefined ? { isActive: input.data.isActive } : {}),
            ...(input.data.isActive !== undefined && input.data.isActive !== existing.isActive ||
            roleChanged
              ? { sessionVersion: { increment: 1 } }
              : {}),
            ...(roleChanged && role
              ? {
                  roles: {
                    deleteMany: {},
                    create: { roleId: role.id },
                  },
                }
              : {}),
          },
          select: { id: true, name: true, email: true, phone: true, smsAlertsEnabled: true, whatsappAlertsEnabled: true, isActive: true, updatedAt: true },
        });
        if (
          input.data.phone !== undefined
          || input.data.smsAlertsEnabled !== undefined
          || input.data.whatsappAlertsEnabled !== undefined
        ) {
          const now = new Date();
          const smsRequeued = phone && smsAlertsEnabled
            ? await transaction.workAssignmentNotification.updateMany({
              where: { assignment: { userId: id }, smsStatus: "FAILED" },
              data: { smsStatus: "PENDING", smsNextAttemptAt: now, smsLastError: null },
            })
            : { count: 0 };
          const whatsappRequeued = phone && whatsappAlertsEnabled
            ? await transaction.workAssignmentNotification.updateMany({
              where: { assignment: { userId: id }, whatsappStatus: "FAILED" },
              data: { whatsappStatus: "PENDING", whatsappNextAttemptAt: now, whatsappLastError: null },
            })
            : { count: 0 };
          const requeuedCount = smsRequeued.count + whatsappRequeued.count;
          if (requeuedCount) {
            await transaction.workAssignmentNotification.updateMany({
              where: {
                assignment: { userId: id },
                OR: [
                  ...(phone && smsAlertsEnabled ? [{ smsStatus: "PENDING" as const }] : []),
                  ...(phone && whatsappAlertsEnabled ? [{ whatsappStatus: "PENDING" as const }] : []),
                ],
              },
              data: { status: "PENDING", nextAttemptAt: now, lastError: null },
            });
            await transaction.auditLog.create({
              data: {
                actorId: authorization.admin!.id,
                action: "WORK_ASSIGNMENT_ALERTS_REQUEUED",
                entityType: "User",
                entityId: id,
                details: { channelCount: requeuedCount },
              },
            });
          }
        }
        await transaction.auditLog.create({
          data: {
            actorId: authorization.admin!.id,
            action: roleChanged
              ? "USER_ROLE_CHANGED"
              : input.data.isActive !== undefined
                ? input.data.isActive
                  ? "USER_ACTIVATED"
                  : "USER_DEACTIVATED"
                : "USER_UPDATED",
            entityType: "User",
            entityId: id,
            details: {
              ...(input.data.name !== undefined ? { nameChanged: true } : {}),
              ...(input.data.phone !== undefined ? { phoneChanged: true } : {}),
              ...(input.data.smsAlertsEnabled !== undefined ? { smsAlertsEnabled } : {}),
              ...(input.data.whatsappAlertsEnabled !== undefined ? { whatsappAlertsEnabled } : {}),
              ...(input.data.smsAlertsEnabled !== undefined
                ? { smsConsentAt: smsConsentAt?.toISOString() ?? null }
                : {}),
              ...(input.data.whatsappAlertsEnabled !== undefined
                ? { whatsappConsentAt: whatsappConsentAt?.toISOString() ?? null }
                : {}),
              ...(input.data.isActive !== undefined ? { isActive: input.data.isActive } : {}),
              ...(roleChanged ? { previousRole: currentRole?.key ?? null, role: role!.key } : {}),
            },
          },
        });
        return updated;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return user
      ? "invalidContact" in user
        ? apiError(422, "INVALID_CONTACT", "A valid phone number is required when SMS or WhatsApp alerts are enabled.")
        : apiSuccess(user)
      : apiError(404, "NOT_FOUND", "Administrator was not found.");
  } catch (error) {
    if (error instanceof LastSuperAdminError) {
      return apiError(409, "LAST_SUPER_ADMIN", "At least one active Super Admin must remain.");
    }
    if (error instanceof InvalidRoleError) {
      return apiError(422, "INVALID_ROLE", "The selected role is unavailable.");
    }
    return handleApiFailure(error);
  }
}

class LastSuperAdminError extends Error {}
class InvalidRoleError extends Error {}

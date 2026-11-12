import { Prisma } from "@/generated/prisma/client";
import { z } from "zod";
import { apiError, apiSuccess, handleApiFailure } from "@/server/api/response";
import { authorizeAdmin } from "@/server/auth/admin-api";
import { prisma } from "@/server/db";
import { rejectCrossOriginMutation } from "@/server/security/same-origin";

const updateSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    isActive: z.boolean().optional(),
    roleKey: z.enum(["SUPER_ADMIN", "ADMIN", "EDITOR", "SALES"]).optional(),
  })
  .refine((value) => Object.keys(value).length > 0);

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const originError = rejectCrossOriginMutation(request);
  if (originError) return originError;
  const authorization = await authorizeAdmin("users:manage");
  if (authorization.response) return authorization.response;
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return apiError(404, "NOT_FOUND", "Administrator was not found.");

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return apiError(400, "INVALID_JSON", "The request body must be valid JSON.");
  }
  const input = updateSchema.safeParse(rawBody);
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
    const user = await prisma.$transaction(
      async (transaction) => {
        await transaction.$queryRaw`SELECT pg_advisory_xact_lock(72340172838076673)`;
        const existing = await transaction.user.findUnique({
          where: { id },
          select: {
            id: true,
            name: true,
            email: true,
            isActive: true,
            roles: { select: { role: { select: { id: true, key: true } } } },
          },
        });
        if (!existing) return null;

        const currentRole = existing.roles[0]?.role;
        const changesSuperAdmin =
          currentRole?.key === "SUPER_ADMIN" &&
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
          select: { id: true, name: true, email: true, isActive: true, updatedAt: true },
        });
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
      ? apiSuccess(user)
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

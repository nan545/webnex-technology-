import "server-only";
import { randomUUID } from "node:crypto";
import { customRoleSchema, type CustomRoleInput } from "@/lib/validation/roles";
import { apiError, handleApiFailure } from "@/server/api/response";
import { prisma, runInTransaction } from "@/server/db";

export class RoleManagementError extends Error {
  constructor(public readonly code: "INVALID_ROLE" | "ROLE_NOT_FOUND" | "ROLE_NAME_EXISTS" | "PROTECTED_ROLE") {
    super(code);
  }
}

export function roleFailure(error: unknown) {
  if (error instanceof RoleManagementError) {
    if (error.code === "ROLE_NAME_EXISTS") return apiError(409, error.code, "A role with that name already exists.");
    if (error.code === "ROLE_NOT_FOUND") return apiError(404, error.code, "Role not found.");
    if (error.code === "PROTECTED_ROLE") return apiError(403, error.code, "Built-in roles cannot be edited.");
    return apiError(422, error.code, "Review the role name and permissions.");
  }
  return handleApiFailure(error);
}

export async function saveCustomRole(
  actorId: string,
  roleId: string | null,
  input: CustomRoleInput,
) {
  const parsed = customRoleSchema.safeParse(input);
  if (!parsed.success) throw new RoleManagementError("INVALID_ROLE");

  return runInTransaction(async (transaction) => {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(72340172838076673)`;
    const existing = roleId ? await transaction.role.findUnique({
      where: { id: roleId },
      select: { id: true, key: true },
    }) : null;
    if (roleId && !existing) throw new RoleManagementError("ROLE_NOT_FOUND");
    if (existing && !existing.key.startsWith("CUSTOM_")) {
      throw new RoleManagementError("PROTECTED_ROLE");
    }

    const duplicate = await transaction.role.findFirst({
      where: {
        name: { equals: parsed.data.name, mode: "insensitive" },
        ...(roleId ? { id: { not: roleId } } : {}),
      },
      select: { id: true },
    });
    if (duplicate) throw new RoleManagementError("ROLE_NAME_EXISTS");
    const permissions = await transaction.permission.findMany({
      where: { key: { in: parsed.data.permissions } },
      select: { id: true },
    });
    if (permissions.length !== parsed.data.permissions.length) {
      throw new RoleManagementError("INVALID_ROLE");
    }

    const role = existing
      ? await transaction.role.update({
          where: { id: existing.id },
          data: {
            name: parsed.data.name,
            permissions: {
              deleteMany: {},
              create: permissions.map((permission) => ({ permissionId: permission.id })),
            },
          },
          select: { id: true },
        })
      : await transaction.role.create({
          data: {
            key: `CUSTOM_${randomUUID()}`,
            name: parsed.data.name,
            permissions: { create: permissions.map((permission) => ({ permissionId: permission.id })) },
          },
          select: { id: true },
        });

    if (existing) {
      await transaction.user.updateMany({
        where: { roles: { some: { roleId: role.id } } },
        data: { sessionVersion: { increment: 1 } },
      });
    }
    await transaction.auditLog.create({
      data: {
        actorId,
        action: existing ? "ROLE_UPDATED" : "ROLE_CREATED",
        entityType: "Role",
        entityId: role.id,
        details: { name: parsed.data.name, permissions: parsed.data.permissions },
      },
    });
    return role;
  }, { maxWait: 5_000, timeout: 10_000 });
}

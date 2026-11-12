import { hash } from "bcryptjs";
import { z } from "zod";
import { apiError, apiSuccess, handleApiFailure, parsePagination } from "@/server/api/response";
import { authorizeAdmin } from "@/server/auth/admin-api";
import { prisma } from "@/server/db";
import { rejectCrossOriginMutation } from "@/server/security/same-origin";

const createUserSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
  password: z
    .string()
    .min(12)
    .max(72)
    .refine((value) => Buffer.byteLength(value, "utf8") <= 72),
  roleKey: z.enum(["SUPER_ADMIN", "ADMIN", "EDITOR", "SALES"]),
});

export async function GET(request: Request) {
  const authorization = await authorizeAdmin("users:manage");
  if (authorization.response) return authorization.response;
  const pagination = parsePagination(new URL(request.url).searchParams);
  if (!pagination) return apiError(400, "INVALID_PAGINATION", "Pagination parameters are invalid.");

  try {
    const [items, totalItems] = await prisma.$transaction([
      prisma.user.findMany({
        orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
        skip: pagination.skip,
        take: pagination.pageSize,
        select: {
          id: true,
          name: true,
          email: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          roles: { select: { role: { select: { key: true, name: true } } } },
        },
      }),
      prisma.user.count(),
    ]);

    return apiSuccess({
      items: items.map(({ roles, ...user }) => ({
        ...user,
        roles: roles.map(({ role }) => role),
      })),
      pagination: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / pagination.pageSize),
      },
    });
  } catch (error) {
    return handleApiFailure(error);
  }
}

export async function POST(request: Request) {
  const originError = rejectCrossOriginMutation(request);
  if (originError) return originError;
  const authorization = await authorizeAdmin("users:manage");
  if (authorization.response) return authorization.response;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return apiError(400, "INVALID_JSON", "The request body must be valid JSON.");
  }
  const input = createUserSchema.safeParse(rawBody);
  if (!input.success) return apiError(422, "VALIDATION_FAILED", "Review the administrator details.");

  try {
    const role = await prisma.role.findUnique({
      where: { key: input.data.roleKey },
      select: { id: true, key: true },
    });
    if (!role) return apiError(422, "INVALID_ROLE", "The selected role is unavailable.");
    if (role.key === "SUPER_ADMIN" && !authorization.admin!.roles.includes("SUPER_ADMIN")) {
      return apiError(403, "FORBIDDEN", "Only a Super Admin can assign that role.");
    }

    const passwordHash = await hash(input.data.password, 12);
    const user = await prisma.$transaction(async (transaction) => {
      const created = await transaction.user.create({
        data: {
          name: input.data.name,
          email: input.data.email,
          passwordHash,
          roles: { create: { roleId: role.id } },
        },
        select: {
          id: true,
          name: true,
          email: true,
          isActive: true,
          createdAt: true,
        },
      });
      await transaction.auditLog.create({
        data: {
          actorId: authorization.admin!.id,
          action: "USER_CREATED",
          entityType: "User",
          entityId: created.id,
          details: { role: role.key },
        },
      });
      return created;
    });

    return apiSuccess(user, { status: 201 });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return apiError(409, "EMAIL_EXISTS", "An account with this email already exists.");
    }
    return handleApiFailure(error);
  }
}

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

import { ContentStatus, Prisma } from "@/generated/prisma/client";
import { cmsServiceCreateSchema } from "@/lib/validation/cms-service";
import { apiError, apiSuccess, handleApiFailure, parsePagination } from "@/server/api/response";
import { authorizeAdmin } from "@/server/auth/admin-api";
import { prisma } from "@/server/db";
import { rejectCrossOriginMutation } from "@/server/security/same-origin";

export async function GET(request: Request) {
  const authorization = await authorizeAdmin("content:read");
  if (authorization.response) return authorization.response;

  const url = new URL(request.url);
  const pagination = parsePagination(url.searchParams);
  if (!pagination) return apiError(400, "INVALID_PAGINATION", "Pagination parameters are invalid.");
  const query = url.searchParams.get("q")?.trim().slice(0, 100);
  const where: Prisma.ServiceWhereInput = query
    ? {
        OR: [
          { title: { contains: query, mode: Prisma.QueryMode.insensitive } },
          { slug: { contains: query, mode: Prisma.QueryMode.insensitive } },
          { summary: { contains: query, mode: Prisma.QueryMode.insensitive } },
        ],
      }
    : {};

  try {
    const [items, totalItems] = await prisma.$transaction([
      prisma.service.findMany({
        where,
        orderBy: [{ updatedAt: "desc" }, { title: "asc" }],
        skip: pagination.skip,
        take: pagination.pageSize,
        select: {
          id: true,
          title: true,
          slug: true,
          summary: true,
          status: true,
          publishedAt: true,
          updatedAt: true,
          updatedBy: { select: { name: true, email: true } },
          _count: { select: { revisions: true } },
        },
      }),
      prisma.service.count({ where }),
    ]);

    return apiSuccess({
      items,
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
  const authorization = await authorizeAdmin("content:write");
  if (authorization.response) return authorization.response;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return apiError(400, "INVALID_JSON", "The request body must be valid JSON.");
  }
  const input = cmsServiceCreateSchema.safeParse(rawBody);
  if (!input.success) return apiError(422, "VALIDATION_FAILED", "Review the service details.");

  try {
    const service = await prisma.$transaction(async (transaction) => {
      const redirectCollision = await transaction.serviceRedirect.findUnique({
        where: { sourceSlug: input.data.slug },
        select: { id: true },
      });
      if (redirectCollision) throw new SlugRedirectCollisionError();
      const created = await transaction.service.create({
        data: {
          ...input.data,
          status: ContentStatus.DRAFT,
          createdById: authorization.admin!.id,
          updatedById: authorization.admin!.id,
        },
      });
      await transaction.serviceRevision.create({
        data: {
          serviceId: created.id,
          authorId: authorization.admin!.id,
          revision: 1,
          title: created.title,
          slug: created.slug,
          summary: created.summary,
          content: created.content ?? Prisma.JsonNull,
          status: created.status,
        },
      });
      await transaction.auditLog.create({
        data: {
          actorId: authorization.admin!.id,
          action: "SERVICE_CREATED",
          entityType: "Service",
          entityId: created.id,
          details: { status: created.status },
        },
      });
      return created;
    });

    return apiSuccess({ id: service.id, title: service.title, slug: service.slug, status: service.status }, { status: 201 });
  } catch (error) {
    if (error instanceof SlugRedirectCollisionError) {
      return apiError(409, "SLUG_EXISTS", "A service redirect already uses this slug.");
    }
    if (isUniqueConstraintError(error)) {
      return apiError(409, "SLUG_EXISTS", "A service with this slug already exists.");
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

class SlugRedirectCollisionError extends Error {}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { ContentStatus, Prisma } from "@/generated/prisma/client";
import { teamMemberCreateSchema } from "@/lib/validation/team-member";
import { apiError, apiSuccess, handleApiFailure, parsePagination } from "@/server/api/response";
import { authorizeAdmin } from "@/server/auth/admin-api";
import { prisma, runInTransaction } from "@/server/db";
import { rejectCrossOriginMutation } from "@/server/security/same-origin";

export async function GET(request: Request) {
  const authorization = await authorizeAdmin("team:view");
  if (authorization.response) return authorization.response;
  const url = new URL(request.url);
  const pagination = parsePagination(url.searchParams);
  if (!pagination) return apiError(400, "INVALID_PAGINATION", "Pagination parameters are invalid.");
  const query = url.searchParams.get("q")?.trim().slice(0, 100);
  const where: Prisma.TeamMemberWhereInput = query
    ? {
        OR: [
          { name: { contains: query, mode: Prisma.QueryMode.insensitive } },
          { title: { contains: query, mode: Prisma.QueryMode.insensitive } },
          { department: { contains: query, mode: Prisma.QueryMode.insensitive } },
        ],
      }
    : {};

  try {
    const [items, totalItems] = await Promise.all([
      prisma.teamMember.findMany({
        where,
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        skip: pagination.skip,
        take: pagination.pageSize,
        select: {
          id: true,
          slug: true,
          name: true,
          title: true,
          department: true,
          biography: true,
          linkedinUrl: true,
          githubUrl: true,
          portfolioUrl: true,
          otherSocialLinks: true,
          sortOrder: true,
          status: true,
          isActive: true,
          publishedAt: true,
          createdAt: true,
          updatedAt: true,
          profileImage: { select: { id: true, altText: true } },
        },
      }),
      prisma.teamMember.count({ where }),
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
  const authorization = await authorizeAdmin("team:create");
  if (authorization.response) return authorization.response;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return apiError(400, "INVALID_JSON", "The request body must be valid JSON.");
  }
  const input = teamMemberCreateSchema.safeParse(rawBody);
  if (!input.success) return apiError(422, "VALIDATION_FAILED", "Review the team member details.");

  try {
    const member = await runInTransaction(async (transaction) => {
      const slug = await createUniqueSlug(transaction, input.data.name);
      const created = await transaction.teamMember.create({
        data: {
          ...input.data,
          slug,
          status: ContentStatus.DRAFT,
          createdById: authorization.admin!.id,
          otherSocialLinks: input.data.otherSocialLinks,
        },
        select: { id: true, slug: true, name: true, status: true },
      });
      await transaction.auditLog.create({
        data: {
          actorId: authorization.admin!.id,
          action: "TEAM_MEMBER_CREATED",
          entityType: "TeamMember",
          entityId: created.id,
          details: { status: created.status },
        },
      });
      return created;
    });
    return apiSuccess(member, { status: 201 });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return apiError(409, "SLUG_EXISTS", "A team profile with this name already exists. Try again.");
    }
    return handleApiFailure(error);
  }
}

async function createUniqueSlug(
  transaction: Prisma.TransactionClient,
  name: string,
) {
  const base = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100) || "team-member";

  for (let suffix = 1; suffix <= 100; suffix += 1) {
    const slug = suffix === 1 ? base : `${base}-${suffix}`;
    const existing = await transaction.teamMember.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!existing) return slug;
  }
  throw new Error("Unable to allocate a unique team profile slug.");
}

function isUniqueConstraintError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { apiError, apiSuccess, handleApiFailure, parsePagination } from "@/server/api/response";
import { countPublishedTeamMembers, listPublishedTeamMembers } from "@/server/content/team";

export async function GET(request: Request) {
  const pagination = parsePagination(new URL(request.url).searchParams);
  if (!pagination) return apiError(400, "INVALID_PAGINATION", "Pagination parameters are invalid.");
  try {
    const [items, totalItems] = await Promise.all([
      listPublishedTeamMembers(pagination.pageSize, pagination.skip),
      countPublishedTeamMembers(),
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

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

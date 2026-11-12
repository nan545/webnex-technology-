import { apiError, apiSuccess, handleApiFailure, parsePagination } from "@/server/api/response";
import { listIndustries } from "@/server/content/public-content";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const pagination = parsePagination(url.searchParams);
  if (!pagination) return apiError(400, "INVALID_PAGINATION", "Pagination parameters are invalid.");
  const query = url.searchParams.get("q");
  if (query && query.length > 100) return apiError(400, "INVALID_QUERY", "Search query is too long.");

  try {
    return apiSuccess(await listIndustries(pagination.page, pagination.pageSize, pagination.skip, query));
  } catch (error) {
    return handleApiFailure(error);
  }
}

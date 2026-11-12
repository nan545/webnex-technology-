import { apiError, apiSuccess, handleApiFailure, parsePagination } from "@/server/api/response";
import { listBlogPosts } from "@/server/content/public-content";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const pagination = parsePagination(url.searchParams);
  if (!pagination) return apiError(400, "INVALID_PAGINATION", "Pagination parameters are invalid.");
  const query = url.searchParams.get("q");
  const category = url.searchParams.get("category");
  if ((query && query.length > 100) || (category && category.length > 100)) {
    return apiError(400, "INVALID_QUERY", "Search or category filter is too long.");
  }

  try {
    return apiSuccess(
      await listBlogPosts(pagination.page, pagination.pageSize, pagination.skip, query, category),
    );
  } catch (error) {
    return handleApiFailure(error);
  }
}

import { apiError, apiSuccess, handleApiFailure, parsePagination } from "@/server/api/response";
import { listTestimonials } from "@/server/content/public-content";

export async function GET(request: Request) {
  const pagination = parsePagination(new URL(request.url).searchParams);
  if (!pagination) return apiError(400, "INVALID_PAGINATION", "Pagination parameters are invalid.");

  try {
    return apiSuccess(
      await listTestimonials(pagination.page, pagination.pageSize, pagination.skip),
    );
  } catch (error) {
    return handleApiFailure(error);
  }
}

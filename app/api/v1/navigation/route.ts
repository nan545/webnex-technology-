import { apiSuccess, handleApiFailure } from "@/server/api/response";
import { getNavigation } from "@/server/content/public-content";

export async function GET() {
  try {
    return apiSuccess(await getNavigation());
  } catch (error) {
    return handleApiFailure(error);
  }
}

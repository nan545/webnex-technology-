import { apiSuccess, handleApiFailure } from "@/server/api/response";
import { getPublicSiteSettings } from "@/server/content/public-content";

export async function GET() {
  try {
    return apiSuccess(await getPublicSiteSettings());
  } catch (error) {
    return handleApiFailure(error);
  }
}

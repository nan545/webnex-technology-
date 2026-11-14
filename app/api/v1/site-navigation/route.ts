import { apiSuccess, handleApiFailure } from "@/server/api/response";
import { readNavigationConfiguration } from "@/server/content/site-configuration";

export async function GET() {
  try {
    return apiSuccess(await readNavigationConfiguration());
  } catch (error) {
    return handleApiFailure(error);
  }
}

export const dynamic = "force-dynamic";

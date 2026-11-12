import { apiError, apiSuccess, handleApiFailure } from "@/server/api/response";
import { getCaseStudy } from "@/server/content/public-content";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const item = await getCaseStudy(slug);
    return item
      ? apiSuccess(item)
      : apiError(404, "NOT_FOUND", "The requested case study was not found.");
  } catch (error) {
    return handleApiFailure(error);
  }
}

import { NextResponse } from "next/server";
import { apiError, apiSuccess, handleApiFailure } from "@/server/api/response";
import { getService } from "@/server/content/public-content";
import { getPublishedServiceForWebsite } from "@/server/content/services";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const item = await getService(slug);
    if (!item) {
      const redirect = await getPublishedServiceForWebsite(slug);
      if (redirect.redirectSlug) {
        return NextResponse.redirect(
          new URL(`/api/v1/services/${redirect.redirectSlug}`, request.url),
          308,
        );
      }
    }
    return item
      ? apiSuccess(item)
      : apiError(404, "NOT_FOUND", "The requested service was not found.");
  } catch (error) {
    return handleApiFailure(error);
  }
}

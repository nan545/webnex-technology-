import { apiError, apiSuccess, handleApiFailure } from "@/server/api/response";
import { getPublishedTeamMember } from "@/server/content/team";
import { z } from "zod";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  if (!z.string().min(1).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).safeParse(slug).success) {
    return apiError(404, "NOT_FOUND", "Published team member was not found.");
  }
  try {
    const member = await getPublishedTeamMember(slug);
    return member
      ? apiSuccess(member)
      : apiError(404, "NOT_FOUND", "Published team member was not found.");
  } catch (error) {
    return handleApiFailure(error);
  }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

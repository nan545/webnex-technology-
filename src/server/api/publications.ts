import { z } from "zod";
import { publicationKindSchema, publicationSchema } from "@/lib/validation/publication";
import { readBoundedJson } from "@/server/api/bounded-json";
import { apiError, apiSuccess, handleApiFailure } from "@/server/api/response";
import { authorizeAdmin } from "@/server/auth/admin-api";
import { publicationPermission, savePublication } from "@/server/content/publications";
import { rejectCrossOriginMutation } from "@/server/security/same-origin";

export async function writePublication(request: Request, rawKind: string, id: string | null) {
  const originError = rejectCrossOriginMutation(request);
  if (originError) return originError;
  const kind = publicationKindSchema.safeParse(rawKind);
  if (!kind.success || (id && !z.string().uuid().safeParse(id).success)) return apiError(404, "NOT_FOUND", "Content was not found.");
  const authorization = await authorizeAdmin(publicationPermission(kind.data));
  if (authorization.response) return authorization.response;
  const body = await readBoundedJson(request, 96_000);
  if (body.error) return body.error;
  const input = publicationSchema.safeParse(body.value);
  if (!input.success) return apiError(422, "VALIDATION_FAILED", "Review the title, URL, summary, category and content.");
  try {
    const result = await savePublication(kind.data, id, input.data, authorization.admin.id, authorization.admin.permissions.has("content:publish"));
    if ("error" in result) {
      if (result.error === "NOT_FOUND") return apiError(404, "NOT_FOUND", "Content was not found.");
      if (result.error === "SLUG_LOCKED") return apiError(409, "SLUG_LOCKED", "The URL cannot be changed after publication.");
      return apiError(403, "FORBIDDEN", "Publishing or changing published content requires publication permission.");
    }
    return apiSuccess({ id: result.id }, { status: id ? 200 : 201 });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return apiError(409, "SLUG_EXISTS", "This URL is already in use.");
    }
    return handleApiFailure(error);
  }
}

import { z } from "zod";
import { workProjectSchema } from "@/lib/validation/work-project";
import { readBoundedJson } from "@/server/api/bounded-json";
import { apiError, apiSuccess, handleApiFailure } from "@/server/api/response";
import { authorizeAdmin } from "@/server/auth/admin-api";
import { saveWorkProject } from "@/server/content/work-projects";
import { rejectCrossOriginMutation } from "@/server/security/same-origin";

export async function writeWorkProject(request: Request, id: string | null) {
  const originError = rejectCrossOriginMutation(request);
  if (originError) return originError;
  const authorization = await authorizeAdmin("projects:manage");
  if (authorization.response) return authorization.response;
  if (id && !z.string().uuid().safeParse(id).success) return apiError(404, "NOT_FOUND", "Work project was not found.");
  const body = await readBoundedJson(request, 96_000);
  if (body.error) return body.error;
  const input = workProjectSchema.safeParse(body.value);
  if (!input.success) return apiError(422, "VALIDATION_FAILED", "Review the project details and assigned accounts.");
  try {
    const result = await saveWorkProject(id, input.data, authorization.admin.id);
    if ("error" in result) {
      return result.error === "NOT_FOUND"
        ? apiError(404, "NOT_FOUND", "Work project was not found.")
        : apiError(422, "INVALID_ASSIGNEES", "Assign only active accounts that can sign in to the dashboard.");
    }
    return apiSuccess(result, { status: id ? 200 : 201 });
  } catch (error) {
    return handleApiFailure(error);
  }
}

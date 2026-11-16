import { z } from "zod";
import { customRoleSchema } from "@/lib/validation/roles";
import { readBoundedJson } from "@/server/api/bounded-json";
import { apiError, apiSuccess } from "@/server/api/response";
import { authorizeSuperAdmin } from "@/server/auth/admin-api";
import { roleFailure, saveCustomRole } from "@/server/auth/role-management";
import { rejectCrossOriginMutation } from "@/server/security/same-origin";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const originError = rejectCrossOriginMutation(request);
  if (originError) return originError;
  const authorization = await authorizeSuperAdmin("roles:manage");
  if (authorization.response) return authorization.response;
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return apiError(404, "ROLE_NOT_FOUND", "Role not found.");
  const body = await readBoundedJson(request);
  if (body.error) return body.error;
  const parsed = customRoleSchema.safeParse(body.value);
  if (!parsed.success) return apiError(422, "VALIDATION_FAILED", "Review the role name and permissions.");

  try {
    const role = await saveCustomRole(authorization.admin.id, id, parsed.data);
    return apiSuccess(role);
  } catch (error) {
    return roleFailure(error);
  }
}

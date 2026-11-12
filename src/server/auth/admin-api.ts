import { apiError } from "@/server/api/response";
import { getAdminContext } from "@/server/auth/authorization";

export async function authorizeAdmin(permission: string) {
  const admin = await getAdminContext();
  if (!admin) {
    return {
      admin: null,
      response: apiError(401, "UNAUTHENTICATED", "Administrator sign-in is required."),
    };
  }
  if (!admin.permissions.has(permission)) {
    return {
      admin: null,
      response: apiError(403, "FORBIDDEN", "You do not have permission to perform this action."),
    };
  }
  return { admin, response: null };
}

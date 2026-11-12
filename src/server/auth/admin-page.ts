import { redirect } from "next/navigation";
import { getAdminContext } from "@/server/auth/authorization";

export async function requireAdminPage(permission: string) {
  const admin = await getAdminContext();
  if (!admin) redirect("/admin/login");
  if (!admin.permissions.has(permission)) redirect("/admin/unauthorized");
  return admin;
}

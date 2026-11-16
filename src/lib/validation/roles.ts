import { z } from "zod";

export const restrictedRolePermissions = ["users:manage", "roles:manage"] as const;

export const roleKeySchema = z.string().min(1).max(100);

export const customRoleSchema = z.object({
  name: z.string().trim().min(2).max(60),
  permissions: z.array(z.string().min(1).max(100)).min(1).max(100)
    .refine((permissions) => new Set(permissions).size === permissions.length, "Permissions must be unique.")
    .refine((permissions) => permissions.includes("dashboard:read"), "Dashboard access is required.")
    .refine(
      (permissions) => !permissions.some((permission) =>
        restrictedRolePermissions.some((restricted) => restricted === permission)),
      "User and role management is reserved for Super Admins.",
    ),
}).strict();

export type CustomRoleInput = z.infer<typeof customRoleSchema>;

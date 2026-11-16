"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { errorMessage } from "@/lib/api/error-message";
import { customRoleSchema, restrictedRolePermissions } from "@/lib/validation/roles";

type Permission = { key: string; description: string | null };
type Role = { id: string; key: string; name: string; permissions: string[] };

export function RoleManagement({ roles, permissions }: { roles: Role[]; permissions: Permission[] }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string[]>(["dashboard:read"]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const editablePermissions = permissions.filter(
    (permission) => !restrictedRolePermissions.some((key) => key === permission.key),
  );

  function resetForm() {
    setEditingId(null);
    setName("");
    setSelected(["dashboard:read"]);
    setError("");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    const parsed = customRoleSchema.safeParse({ name, permissions: selected });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Review the role details.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(editingId ? `/api/admin/v1/roles/${editingId}` : "/api/admin/v1/roles", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      if (!response.ok) throw new Error(await errorMessage(response));
      setMessage(editingId ? "Role updated. Assigned users must sign in again." : "Role created.");
      resetForm();
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The role could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-5 border border-border bg-white p-5 sm:p-7">
      <div>
        <h2 className="font-semibold">Roles and permissions</h2>
        <p className="mt-1 text-sm text-muted">
          Built-in roles cannot be edited. User and role management is reserved for Super Admins.
        </p>
      </div>
      <div className="divide-y divide-border border border-border">
        {roles.map((role) => (
          <div className="flex flex-wrap items-center justify-between gap-3 p-4" key={role.id}>
            <div>
              <p className="font-medium">{role.name}</p>
              <p className="text-xs text-muted">
                {role.key.startsWith("CUSTOM_") ? "Custom role" : "Built-in role"} · {role.permissions.length} permissions
              </p>
              <details className="mt-2 text-sm text-muted">
                <summary className="cursor-pointer">View permissions</summary>
                <ul className="mt-2 space-y-1">
                  {role.permissions.map((key) => (
                    <li key={key}>{permissions.find((permission) => permission.key === key)?.description || key}</li>
                  ))}
                </ul>
              </details>
            </div>
            {role.key.startsWith("CUSTOM_") ? (
              <button className="button-secondary" disabled={busy} onClick={() => {
                setEditingId(role.id);
                setName(role.name);
                setSelected(role.permissions);
                setMessage("");
                setError("");
              }} type="button">Edit {role.name}</button>
            ) : null}
          </div>
        ))}
      </div>
      <form className="space-y-4 border-t border-border pt-5" onSubmit={save}>
        <h3 className="font-semibold">{editingId ? "Edit custom role" : "Create custom role"}</h3>
        <label className="block text-sm font-medium" htmlFor="custom-role-name">Role name</label>
        <input className="field-control max-w-md" disabled={busy} id="custom-role-name" maxLength={60} minLength={2} onChange={(event) => setName(event.target.value)} required value={name} />
        <fieldset>
          <legend className="text-sm font-medium">Permissions</legend>
          <p className="mt-1 text-xs text-muted">Dashboard access is required for every administrator.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {editablePermissions.map((permission) => (
              <label className="flex items-start gap-2 text-sm" key={permission.key}>
                <input
                  checked={selected.includes(permission.key)}
                  disabled={busy || permission.key === "dashboard:read"}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setSelected((current) => checked
                      ? [...current, permission.key]
                      : current.filter((key) => key !== permission.key));
                  }}
                  type="checkbox"
                />
                <span>{permission.description || permission.key}</span>
              </label>
            ))}
          </div>
        </fieldset>
        {error ? <p className="text-sm text-red-800" role="alert">{error}</p> : null}
        {message ? <p className="text-sm text-green-800" role="status">{message}</p> : null}
        <div className="flex flex-wrap gap-3">
          <button className="button-primary" disabled={busy} type="submit">{busy ? "Saving…" : editingId ? "Save role" : "Create role"}</button>
          {editingId ? <button className="button-secondary" disabled={busy} onClick={resetForm} type="button">Cancel edit</button> : null}
        </div>
      </form>
    </section>
  );
}

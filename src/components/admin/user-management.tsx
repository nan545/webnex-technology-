"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type AdminUserRow = {
  id: string;
  name: string | null;
  email: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  roleKey: string;
};

const roleOptions = ["SUPER_ADMIN", "ADMIN", "EDITOR", "SALES"];

export function UserManagement({
  users,
  currentUserId,
}: {
  users: AdminUserRow[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [roleKey, setRoleKey] = useState("EDITOR");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/v1/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, roleKey }),
      });
      if (!response.ok) throw new Error(await errorMessage(response));
      setName("");
      setEmail("");
      setPassword("");
      setMessage("Administrator account created.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create account.");
    } finally {
      setSaving(false);
    }
  }

  async function updateUser(user: AdminUserRow, changes: { isActive?: boolean; roleKey?: string }) {
    if (changes.isActive === false && !window.confirm(`Deactivate ${user.email}? They will lose access immediately.`)) return;
    if (changes.roleKey && !window.confirm(`Change ${user.email}'s role to ${changes.roleKey}?`)) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/admin/v1/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes),
      });
      if (!response.ok) throw new Error(await errorMessage(response));
      setMessage("Administrator account updated.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update account.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-7">
      <form className="grid gap-4 border border-border bg-white p-5 sm:grid-cols-2 sm:p-7" onSubmit={createUser}>
        <div className="sm:col-span-2">
          <h2 className="font-semibold">Create administrator</h2>
          <p className="mt-1 text-sm text-muted">Initial credentials are provided out-of-band by a Super Admin.</p>
        </div>
        <div>
          <label className="field-label" htmlFor="new-admin-name">Full name</label>
          <input className="field-control" id="new-admin-name" maxLength={120} minLength={2} onChange={(event) => setName(event.target.value)} required value={name} />
        </div>
        <div>
          <label className="field-label" htmlFor="new-admin-email">Email address</label>
          <input className="field-control" autoComplete="email" id="new-admin-email" maxLength={254} onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
        </div>
        <div>
          <label className="field-label" htmlFor="new-admin-password">Temporary password</label>
          <input className="field-control" autoComplete="new-password" id="new-admin-password" maxLength={72} minLength={12} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} />
          <p className="mt-1 text-xs text-muted">12–72 characters. Share it through a separate secure channel.</p>
        </div>
        <div>
          <label className="field-label" htmlFor="new-admin-role">Role</label>
          <select className="field-control" id="new-admin-role" onChange={(event) => setRoleKey(event.target.value)} value={roleKey}>
            {roleOptions.map((role) => <option key={role} value={role}>{role.replaceAll("_", " ")}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <button className="button-primary" disabled={saving} type="submit">{saving ? "Creating…" : "Create account"}</button>
        </div>
      </form>

      <section className="overflow-hidden border border-border bg-white">
        <div className="border-b border-border px-5 py-4">
          <h2 className="font-semibold">Administrator accounts</h2>
          <p className="mt-1 text-sm text-muted">{users.length} accounts on this page</p>
        </div>
        {users.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Administrator</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Last sign-in</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map((user) => (
                  <tr key={user.id}>
                    <td className="px-4 py-4">
                      <p className="font-medium">{user.name ?? "Name not set"}</p>
                      <p className="mt-1 text-xs text-muted">{user.email}</p>
                    </td>
                    <td className="px-4 py-4">
                      <select
                        aria-label={`Role for ${user.email}`}
                        className="min-h-10 border border-border bg-white px-2"
                        disabled={saving || user.id === currentUserId}
                        onChange={(event) => void updateUser(user, { roleKey: event.target.value })}
                        value={user.roleKey}
                      >
                        {!user.roleKey ? <option value="">No role assigned</option> : null}
                        {roleOptions.map((role) => <option key={role} value={role}>{role.replaceAll("_", " ")}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-4">{user.isActive ? "Active" : "Disabled"}</td>
                    <td className="px-4 py-4 text-muted">{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString("en-GH") : "Never"}</td>
                    <td className="px-4 py-4">
                      {user.id === currentUserId ? (
                        <span className="text-xs text-muted">Current account</span>
                      ) : (
                        <button
                          className="min-h-10 border border-border px-3 text-xs font-medium hover:border-blue-700 hover:text-blue-700"
                          disabled={saving}
                          onClick={() => void updateUser(user, { isActive: !user.isActive })}
                          type="button"
                        >
                          {user.isActive ? "Deactivate" : "Activate"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-5 py-10 text-sm text-muted">No administrator accounts found.</p>
        )}
      </section>
      <div aria-live="polite" className="min-h-6">
        {error ? <p className="text-sm text-red-800" role="alert">{error}</p> : null}
        {message ? <p className="text-sm text-green-800" role="status">{message}</p> : null}
      </div>
    </div>
  );
}

async function errorMessage(response: Response) {
  const payload: unknown = await response.json().catch(() => undefined);
  if (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof payload.error === "object" &&
    payload.error !== null &&
    "message" in payload.error &&
    typeof payload.error.message === "string"
  ) {
    return payload.error.message;
  }
  return "The request could not be completed.";
}

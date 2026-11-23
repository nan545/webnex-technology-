"use client";

import { useRouter } from "next/navigation";
import { Fragment, useState, type FormEvent } from "react";
import { errorMessage } from "@/lib/api/error-message";

type AdminUserRow = {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  smsAlertsEnabled: boolean;
  whatsappAlertsEnabled: boolean;
  smsConsentAt: string | null;
  whatsappConsentAt: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  roleKey: string;
};

const builtInRoleKeys = ["SUPER_ADMIN", "ADMIN", "EDITOR", "SALES"];

export function UserManagement({
  users,
  currentUserId,
  roles,
}: {
  users: AdminUserRow[];
  currentUserId: string;
  roles: Array<{ key: string; name: string }>;
}) {
  const router = useRouter();
  const roleOptions = [...roles].sort((a, b) => {
    const aIndex = builtInRoleKeys.indexOf(a.key);
    const bIndex = builtInRoleKeys.indexOf(b.key);
    if (aIndex !== -1 || bIndex !== -1) return (aIndex === -1 ? 4 : aIndex) - (bIndex === -1 ? 4 : bIndex);
    return a.name.localeCompare(b.name);
  });
  const roleLabel = (role: { key: string; name: string }) =>
    builtInRoleKeys.includes(role.key) ? role.key.replaceAll("_", " ") : role.name;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [smsAlertsEnabled, setSmsAlertsEnabled] = useState(false);
  const [whatsappAlertsEnabled, setWhatsappAlertsEnabled] = useState(false);
  const [password, setPassword] = useState("");
  const [roleKey, setRoleKey] = useState(roles.find((role) => role.key === "EDITOR")?.key ?? "");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [resetUser, setResetUser] = useState<AdminUserRow | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [contactUserId, setContactUserId] = useState<string | null>(null);
  const [contactPhone, setContactPhone] = useState("");
  const [contactSmsEnabled, setContactSmsEnabled] = useState(false);
  const [contactWhatsappEnabled, setContactWhatsappEnabled] = useState(false);

  function closeReset() {
    setResetUser(null);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }
  async function resetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!resetUser) return;
    setError("");
    setMessage("");
    if (newPassword !== confirmPassword) {
      setError("The new passwords do not match.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/v1/users/${resetUser.id}/password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!response.ok) throw new Error(await errorMessage(response));
      closeReset();
      setMessage("Password reset. Share the new password securely; the administrator must sign in again.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to reset the password.");
    } finally {
      setSaving(false);
    }
  }

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/v1/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, roleKey, phone, smsAlertsEnabled, whatsappAlertsEnabled }),
      });
      if (!response.ok) throw new Error(await errorMessage(response));
      setName("");
      setEmail("");
      setPhone("");
      setPassword("");
      setSmsAlertsEnabled(false);
      setWhatsappAlertsEnabled(false);
      setMessage("Administrator account created.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create account.");
    } finally {
      setSaving(false);
    }
  }

  function editContact(user: AdminUserRow) {
    setContactUserId(user.id);
    setContactPhone(user.phone ?? "");
    setContactSmsEnabled(user.smsAlertsEnabled);
    setContactWhatsappEnabled(user.whatsappAlertsEnabled);
  }

  async function saveContact(event: FormEvent<HTMLFormElement>, user: AdminUserRow) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/admin/v1/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: contactPhone,
          smsAlertsEnabled: contactSmsEnabled,
          whatsappAlertsEnabled: contactWhatsappEnabled,
        }),
      });
      if (!response.ok) throw new Error(await errorMessage(response));
      setContactUserId(null);
      setMessage("Message alert contact settings saved. Failed alerts for active assignments were requeued where eligible.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update message alert settings.");
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
          <label className="field-label" htmlFor="new-admin-phone">Mobile number</label>
          <input className="field-control" autoComplete="tel" id="new-admin-phone" maxLength={40} onChange={(event) => setPhone(event.target.value)} required={smsAlertsEnabled || whatsappAlertsEnabled} type="tel" value={phone} />
          <p className="mt-1 text-xs text-muted">Use international format, e.g. +233…</p>
        </div>
        <div>
          <label className="field-label" htmlFor="new-admin-password">Initial password</label>
          <input className="field-control" autoComplete="new-password" id="new-admin-password" maxLength={72} minLength={12} onChange={(event) => setPassword(event.target.value)} required type="password" value={password} />
          <p className="mt-1 text-xs text-muted">12–72 UTF-8 bytes. Share it securely; self-service password changes are not yet available.</p>
        </div>
        <fieldset className="space-y-2 sm:col-span-2">
          <legend className="field-label">Project assignment alerts</legend>
          <p className="text-xs text-muted">Only enable a channel after the account holder has agreed to receive project alerts there.</p>
          <label className="flex items-center gap-2 text-sm"><input checked={smsAlertsEnabled} onChange={(event) => setSmsAlertsEnabled(event.target.checked)} type="checkbox" />SMS alerts consent recorded</label>
          <label className="flex items-center gap-2 text-sm"><input checked={whatsappAlertsEnabled} onChange={(event) => setWhatsappAlertsEnabled(event.target.checked)} type="checkbox" />WhatsApp alerts consent recorded</label>
        </fieldset>
        <div>
          <label className="field-label" htmlFor="new-admin-role">Role</label>
          <select className="field-control" id="new-admin-role" onChange={(event) => setRoleKey(event.target.value)} required value={roleKey}>
            {!roleKey ? <option value="">Select a role</option> : null}
            {roleOptions.map((role) => <option key={role.key} value={role.key}>{roleLabel(role)}</option>)}
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
                  <th className="px-4 py-3 font-medium">Project alerts</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Last sign-in</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map((user) => (
                  <Fragment key={user.id}>
                  <tr>
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
                        {roleOptions.map((role) => <option key={role.key} value={role.key}>{roleLabel(role)}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-4">
                      <p>SMS: {user.smsAlertsEnabled ? "on" : "off"}</p>
                      <p>WhatsApp: {user.whatsappAlertsEnabled ? "on" : "off"}</p>
                      <p className="mt-1 text-xs text-muted">{user.phone || "No phone number"}</p>
                      {user.smsAlertsEnabled && user.smsConsentAt ? (
                        <p className="mt-1 text-xs text-muted">SMS consent: {new Date(user.smsConsentAt).toLocaleString("en-GH")}</p>
                      ) : null}
                      {user.whatsappAlertsEnabled && user.whatsappConsentAt ? (
                        <p className="mt-1 text-xs text-muted">WhatsApp consent: {new Date(user.whatsappConsentAt).toLocaleString("en-GH")}</p>
                      ) : null}
                      <button
                        className="mt-2 min-h-9 border border-border px-3 text-xs font-medium hover:border-blue-700 hover:text-blue-700"
                        disabled={saving}
                        onClick={() => editContact(user)}
                        type="button"
                      >Edit phone and consent</button>
                    </td>
                    <td className="px-4 py-4">{user.isActive ? "Active" : "Disabled"}</td>
                    <td className="px-4 py-4 text-muted">{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString("en-GH") : "Never"}</td>
                    <td className="px-4 py-4">
                      {user.id === currentUserId ? (
                        <span className="text-xs text-muted">Current account</span>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                        <button
                          className="min-h-10 border border-border px-3 text-xs font-medium hover:border-blue-700 hover:text-blue-700"
                          disabled={saving}
                          onClick={() => void updateUser(user, { isActive: !user.isActive })}
                          type="button"
                        >
                          {user.isActive ? "Deactivate" : "Activate"}
                        </button>
                        {user.isActive ? <button
                          className="min-h-10 border border-border px-3 text-xs font-medium hover:border-blue-700 hover:text-blue-700"
                          disabled={saving}
                          onClick={() => { closeReset(); setError(""); setMessage(""); setResetUser(user); }}
                          type="button"
                        >Reset password</button> : null}
                        </div>
                      )}
                    </td>
                  </tr>
                  {contactUserId === user.id ? <tr key={`${user.id}-alerts`}>
                    <td className="px-4 py-4" colSpan={6}>
                      <form className="grid gap-3 sm:grid-cols-2" onSubmit={(event) => void saveContact(event, user)}>
                        <label className="block"><span className="field-label">Mobile number for SMS and WhatsApp</span><input autoComplete="tel" className="field-control" maxLength={40} onChange={(event) => setContactPhone(event.target.value)} required={contactSmsEnabled || contactWhatsappEnabled} type="tel" value={contactPhone} /></label>
                        <fieldset className="space-y-2">
                          <legend className="field-label">Confirmed consent</legend>
                          <label className="flex items-center gap-2 text-sm"><input checked={contactSmsEnabled} onChange={(event) => setContactSmsEnabled(event.target.checked)} type="checkbox" />SMS alerts enabled</label>
                          <label className="flex items-center gap-2 text-sm"><input checked={contactWhatsappEnabled} onChange={(event) => setContactWhatsappEnabled(event.target.checked)} type="checkbox" />WhatsApp alerts enabled</label>
                        </fieldset>
                        <div className="flex gap-2 sm:col-span-2"><button className="button-primary" disabled={saving} type="submit">{saving ? "Saving…" : "Save alert settings"}</button><button className="button-secondary" disabled={saving} onClick={() => setContactUserId(null)} type="button">Cancel</button></div>
                        <p className="text-xs text-muted sm:col-span-2">Do not enable a channel unless the account holder has explicitly agreed to receive project assignment alerts there. Saving can requeue eligible failed alerts for current assignments.</p>
                      </form>
                    </td>
                  </tr> : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-5 py-10 text-sm text-muted">No administrator accounts found.</p>
        )}
      </section>
      {resetUser ? (
        <form className="grid gap-4 border border-border bg-white p-5 sm:grid-cols-2 sm:p-7" onSubmit={resetPassword}>
          <div className="sm:col-span-2">
            <h2 className="font-semibold">Reset password for {resetUser.name || resetUser.email}</h2>
            <p className="mt-1 text-sm text-muted">This clears login lockout and signs out their existing sessions. Share the new password securely.</p>
          </div>
          <div>
            <label className="field-label" htmlFor="reset-current-password">Your Super Admin password</label>
            <input autoComplete="current-password" className="field-control" id="reset-current-password" maxLength={72} onChange={(event) => setCurrentPassword(event.target.value)} required type="password" value={currentPassword} />
          </div>
          <div>
            <label className="field-label" htmlFor="reset-new-password">New password</label>
            <input autoComplete="new-password" className="field-control" id="reset-new-password" maxLength={72} minLength={12} onChange={(event) => setNewPassword(event.target.value)} required type="password" value={newPassword} />
            <p className="mt-1 text-xs text-muted">12–72 UTF-8 bytes.</p>
          </div>
          <div>
            <label className="field-label" htmlFor="reset-confirm-password">Confirm new password</label>
            <input autoComplete="new-password" className="field-control" id="reset-confirm-password" maxLength={72} minLength={12} onChange={(event) => setConfirmPassword(event.target.value)} required type="password" value={confirmPassword} />
          </div>
          <div className="flex flex-wrap gap-3 sm:col-span-2">
            <button className="button-primary" disabled={saving} type="submit">{saving ? "Resetting…" : "Confirm password reset"}</button>
            <button className="button-secondary" disabled={saving} onClick={() => { closeReset(); setError(""); }} type="button">Cancel</button>
          </div>
        </form>
      ) : null}
      <div aria-live="polite" className="min-h-6">
        {error ? <p className="text-sm text-red-800" role="alert">{error}</p> : null}
        {message ? <p className="text-sm text-green-800" role="status">{message}</p> : null}
      </div>
    </div>
  );
}


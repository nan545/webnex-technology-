"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";

export function AdminUserMenu({ name }: { name: string }) {
  const [submitting, setSubmitting] = useState(false);

  async function handleSignOut() {
    setSubmitting(true);
    await signOut({ callbackUrl: "/admin/login" });
  }

  return (
    <div className="flex items-center gap-3">
      <span className="hidden max-w-48 truncate text-sm text-navy-800 sm:inline">
        {name}
      </span>
      <button
        className="min-h-10 border border-border px-3 text-sm font-medium hover:border-blue-700 hover:text-blue-700"
        disabled={submitting}
        onClick={handleSignOut}
        type="button"
      >
        {submitting ? "Signing out…" : "Sign out"}
      </button>
    </div>
  );
}

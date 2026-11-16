"use client";

import { useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export function AdminLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl: "/admin",
      });
      if (!result || result.error) {
        setError("Sign in failed. Check your details or try again later.");
        return;
      }
      router.replace(result.url ?? "/admin");
      router.refresh();
    } catch {
      setError("Sign in is temporarily unavailable. Please try again later.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
      <div>
        <label className="field-label" htmlFor="admin-email">
          Email address
        </label>
        <input
          autoComplete="username"
          className="field-control"
          id="admin-email"
          maxLength={254}
          onChange={(event) => setEmail(event.target.value)}
          required
          type="email"
          value={email}
        />
      </div>
      <div>
        <label className="field-label" htmlFor="admin-password">
          Password
        </label>
        <input
          autoComplete="current-password"
          className="field-control"
          id="admin-password"
          maxLength={128}
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
      </div>
      <div aria-live="polite" className="min-h-6">
        {error ? (
          <p className="text-sm text-red-800" role="alert">
            {error}
          </p>
        ) : null}
      </div>
      <button className="button-primary w-full" disabled={submitting} type="submit">
        {submitting ? "Signing in…" : "Sign in"}
      </button>
      <p className="text-xs leading-5 text-muted">
        Self-service password reset is unavailable.
        Contact your system administrator.
      </p>
    </form>
  );
}

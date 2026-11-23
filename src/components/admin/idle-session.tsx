"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const refreshInterval = 5_000;

type SessionResponse = {
  user?: { id?: string };
  idleExpires?: number;
};

async function readSession(response: Response): Promise<SessionResponse | null> {
  if (!response.ok) throw new Error("Session request failed");
  const session: SessionResponse | null = await response.json();
  return session?.user?.id && typeof session.idleExpires === "number" ? session : null;
}

export function IdleSession() {
  const [unavailable, setUnavailable] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let active = true;
    let expiryTimer: ReturnType<typeof setTimeout> | undefined;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    let lastRefresh = 0;
    let deadline: number | undefined;
    let refreshing = false;
    let pending = false;

    function expire() {
      if (active) {
        router.replace("/admin/login?reason=idle");
        router.refresh();
      }
    }

    function scheduleExpiry(session: SessionResponse | null) {
      if (!active) return;
      if (!session || session.idleExpires === undefined) {
        expire();
        return;
      }
      deadline = session.idleExpires;
      clearTimeout(expiryTimer);
      expiryTimer = setTimeout(checkSession, Math.max(1000, session.idleExpires - Date.now()));
      setUnavailable(false);
    }

    async function checkSession() {
      try {
        const response = await fetch("/api/auth/session", { cache: "no-store" });
        scheduleExpiry(await readSession(response));
      } catch {
        if (active) {
          if (deadline !== undefined && Date.now() >= deadline) {
            expire();
          } else {
            setUnavailable(true);
            expiryTimer = setTimeout(checkSession, refreshInterval);
          }
        }
      }
    }

    async function refreshSession() {
      if (!active || refreshing || !pending) return;
      pending = false;
      refreshing = true;
      try {
        const csrfResponse = await fetch("/api/auth/csrf", { cache: "no-store" });
        if (!csrfResponse.ok) throw new Error("CSRF request failed");
        const csrf: { csrfToken?: string } = await csrfResponse.json();
        if (!csrf.csrfToken) throw new Error("CSRF token missing");
        const response = await fetch("/api/auth/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ csrfToken: csrf.csrfToken, data: {} }),
        });
        const session = await readSession(response);
        lastRefresh = Date.now();
        scheduleExpiry(session);
      } catch {
        if (active) setUnavailable(true);
      } finally {
        refreshing = false;
        if (active && pending) {
          refreshTimer = setTimeout(() => {
            refreshTimer = undefined;
            void refreshSession();
          }, Math.max(0, lastRefresh + refreshInterval - Date.now()));
        }
      }
    }

    function onActivity(event: Event) {
      if (!event.isTrusted) return;
      pending = true;
      if (!refreshing && !refreshTimer) {
        const delay = Math.max(0, lastRefresh + refreshInterval - Date.now());
        refreshTimer = setTimeout(() => {
          refreshTimer = undefined;
          void refreshSession();
        }, delay);
      }
    }

    const events = ["pointerdown", "keydown", "scroll", "touchstart"] as const;
    for (const event of events) window.addEventListener(event, onActivity, { passive: true });
    void checkSession();
    return () => {
      active = false;
      clearTimeout(expiryTimer);
      clearTimeout(refreshTimer);
      for (const event of events) window.removeEventListener(event, onActivity);
    };
  }, [router]);

  return unavailable ? (
    <p className="border-b border-amber-300 bg-amber-50 px-5 py-3 text-sm text-amber-900" role="alert">
      The session could not be refreshed. Check your connection; you may need to sign in again.
    </p>
  ) : null;
}

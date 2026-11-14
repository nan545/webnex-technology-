"use client";

import { useEffect, useState, type ReactNode } from "react";

export function DatabaseStatus({ children }: { children: ReactNode }) {
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    let controller: AbortController;

    async function check() {
      controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8_000);
      try {
        const response = await fetch("/api/v1/health", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (active) setUnavailable(!response.ok);
      } catch {
        if (active) setUnavailable(true);
      } finally {
        clearTimeout(timeout);
        if (active) timer = setTimeout(check, 15_000);
      }
    }

    void check();
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, []);

  return (
    <>
      {unavailable ? (
        <p className="mb-5 border border-red-200 bg-white p-4 text-sm text-red-900" role="alert">
          Database connectivity could not be verified. Editing is disabled until the connection returns.
          Your unsaved form entries remain on this page.
        </p>
      ) : null}
      <fieldset className="min-w-0" disabled={unavailable}>
        {children}
      </fieldset>
    </>
  );
}

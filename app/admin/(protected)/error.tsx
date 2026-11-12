"use client";

import { useEffect } from "react";

export default function AdminError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Administrative page failed to load.");
  }, []);

  return (
    <section className="border border-red-200 bg-white p-6" role="alert">
      <h1 className="text-lg font-semibold text-red-900">This admin page is unavailable.</h1>
      <p className="mt-2 text-sm leading-6 text-muted">
        The requested administrative data could not be loaded. Check database connectivity and try again.
      </p>
      <button className="button-primary mt-5" onClick={reset} type="button">Try again</button>
    </section>
  );
}

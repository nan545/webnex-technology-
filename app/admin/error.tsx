"use client";

import { useEffect } from "react";

export default function AdminRootError({ reset }: { reset: () => void }) {
  useEffect(() => {
    console.error("Administrative application failed to load.");
  }, []);

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-6">
      <section className="max-w-lg border border-red-200 bg-white p-7" role="alert">
        <h1 className="text-xl font-semibold text-navy-950">Admin is unavailable</h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          The authentication service or database could not complete this request.
          Check server configuration and try again.
        </p>
        <button className="button-primary mt-6" onClick={reset} type="button">Try again</button>
      </section>
    </main>
  );
}

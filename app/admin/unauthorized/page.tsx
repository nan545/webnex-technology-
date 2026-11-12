import Link from "next/link";

export default function UnauthorizedAdminPage() {
  return (
    <main className="grid min-h-screen place-items-center px-6">
      <section className="max-w-lg text-center">
        <h1 className="text-2xl font-semibold text-navy-950">Access not permitted</h1>
        <p className="mt-3 leading-7 text-muted">
          Your administrator account does not have permission to view this area.
        </p>
        <Link className="mt-6 inline-flex min-h-11 items-center text-sm font-semibold text-blue-700" href="/admin">
          Return to dashboard
        </Link>
      </section>
    </main>
  );
}

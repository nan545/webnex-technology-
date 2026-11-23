import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { AdminLoginForm } from "@/components/admin/login-form";
import { authOptions } from "@/server/auth/options";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Administrator sign in" };

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (session?.user?.id) redirect("/admin");
  const { reason } = await searchParams;

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-5 py-12">
      <section className="w-full max-w-md border border-border bg-white p-7 shadow-sm sm:p-9">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
          WEBNEX Technologies
        </p>
        <h1 className="mt-4 text-2xl font-semibold text-navy-950">
          Administrator sign in
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          This area is restricted to authorized WEBNEX personnel.
        </p>
        {reason === "idle" ? (
          <p className="mt-4 text-sm text-navy-800" role="status">
            Your session ended after inactivity. Please sign in again.
          </p>
        ) : null}
        <AdminLoginForm />
      </section>
    </main>
  );
}

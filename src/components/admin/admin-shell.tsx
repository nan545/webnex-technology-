import Link from "next/link";
import type { ReactNode } from "react";
import type { AdminContext } from "@/server/auth/authorization";
import { AdminUserMenu } from "@/components/admin/admin-user-menu";
import { DatabaseStatus } from "@/components/admin/database-status";
import { BrandLogo } from "@/components/layout/brand-logo";

const activeNavigation = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/pipeline", label: "Sales pipeline", permission: "enquiries:read" },
  { href: "/admin/follow-ups", label: "Follow-ups", permission: "enquiries:read" },
  { href: "/admin/proposals", label: "Proposals", permission: "proposals:manage" },
  { href: "/admin/integrations", label: "Integrations", permission: "settings:manage" },
  { href: "/admin/services", label: "Services", permission: "content:read" },
  { href: "/admin/publications/projects", label: "Projects", permission: "projects:manage" },
  { href: "/admin/publications/insights", label: "Insights", permission: "blog:manage" },
  { href: "/admin/team", label: "Team Members", permission: "team:view" },
  { href: "/admin/enquiries", label: "Enquiries", permission: "enquiries:read" },
  { href: "/admin/users", label: "Users and roles", permission: "users:manage" },
  { href: "/admin/audit-logs", label: "Audit logs", permission: "audit:read" },
  { href: "/admin/navigation", label: "Navigation", permission: "content:publish" },
  { href: "/admin/settings", label: "Settings", permission: "settings:manage" },
] as const;

const navigationGroups = [
  { permission: "projects:manage", labels: ["Case studies", "Industries"] },
  { permission: "testimonials:manage", labels: ["Testimonials"] },
  { permission: "media:manage", labels: ["Media library"] },
] as const;

export function AdminShell({
  admin,
  children,
}: {
  admin: AdminContext;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50 text-navy-950 lg:grid lg:grid-cols-[250px_minmax(0,1fr)]">
      <aside className="border-b border-border bg-navy-950 text-white lg:min-h-screen lg:border-b-0 lg:border-r">
        <Link aria-label="WEBNEX Technologies admin" className="flex min-h-[72px] items-center gap-3 border-b border-white/15 px-6" href="/admin">
          <BrandLogo className="w-32" inverse />
          <span className="text-xs font-medium tracking-wide text-blue-200">ADMIN</span>
        </Link>
        <nav aria-label="Administration" className="grid grid-cols-2 gap-1 p-3 sm:grid-cols-4 lg:block">
          <p className="hidden px-3 pb-2 pt-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-200 lg:block">
            Workspace
          </p>
          {activeNavigation
            .filter((item) => !("permission" in item) || admin.permissions.has(item.permission))
            .map((item) => (
              <Link
                className="flex min-h-11 items-center px-3 text-sm text-slate-100 hover:bg-white/10 hover:text-white"
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            ))}
          <p className="col-span-2 px-3 pb-2 pt-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-200 sm:col-span-4 lg:col-span-1">
            Content modules
          </p>
          <div className="col-span-2 grid grid-cols-2 gap-1 sm:col-span-4 lg:block">
            {navigationGroups
              .filter(({ permission }) => admin.permissions.has(permission))
              .flatMap(({ labels }) => labels)
              .map((label) => (
                <span
                  aria-disabled="true"
                  className="flex min-h-10 items-center px-3 text-xs text-slate-400"
                  key={label}
                  title="This module is not implemented yet"
                >
                  {label}
                  <span className="ml-auto text-[10px]">Pending</span>
                </span>
              ))}
          </div>
        </nav>
      </aside>
      <div className="min-w-0">
        <header className="flex min-h-[72px] items-center justify-between border-b border-border bg-white px-5 sm:px-8">
          <div>
            <p className="text-xs text-muted">Administration / Workspace</p>
            <p className="mt-1 text-sm font-semibold">WEBNEX Technologies</p>
          </div>
          <AdminUserMenu name={admin.name ?? admin.email} />
        </header>
        <main className="mx-auto w-full max-w-[1440px] p-5 sm:p-8">
          <DatabaseStatus>{children}</DatabaseStatus>
        </main>
      </div>
    </div>
  );
}

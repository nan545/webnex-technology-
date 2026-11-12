"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronDown, Menu, X } from "lucide-react";
import { services } from "@/data/services";
import { siteConfig } from "@/config/site";

export function Header() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileOpen(false);
        setServicesOpen(false);
      }
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);

  function closeMenus() {
    setMobileOpen(false);
    setServicesOpen(false);
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-white/95 backdrop-blur">
      <div className="mx-auto flex min-h-[76px] w-full max-w-7xl items-center justify-between px-6 sm:px-10 lg:px-12">
        <Link
          aria-label="WEBNEX Technologies home"
          className="flex items-center gap-2 text-sm font-bold tracking-[0.12em] text-navy-950"
          href="/"
          onClick={closeMenus}
        >
          <span className="grid size-9 place-items-center bg-navy-950 text-xs font-bold tracking-normal text-white">
            WN
          </span>
          <span>
            WEBNEX
            <span className="ml-1.5 font-normal tracking-normal text-muted">
              TECHNOLOGIES
            </span>
          </span>
        </Link>

        <nav aria-label="Main navigation" className="hidden items-center gap-7 lg:flex">
          {siteConfig.navigation.slice(0, 2).map((item) => (
            <NavLink
              key={item.href}
              active={pathname === item.href}
              href={item.href}
              onClick={closeMenus}
            >
              {item.label}
            </NavLink>
          ))}
          <div className="relative">
            <button
              aria-expanded={servicesOpen}
              aria-haspopup="true"
              className={`flex min-h-11 items-center gap-1 text-sm font-medium transition-colors hover:text-blue-700 ${pathname.startsWith("/services") ? "text-blue-700" : "text-navy-800"}`}
              onClick={() => setServicesOpen((open) => !open)}
              type="button"
            >
              Services <ChevronDown aria-hidden="true" size={15} />
            </button>
            {servicesOpen ? (
              <div className="absolute left-0 top-full mt-2 w-72 border border-border bg-white p-2 shadow-lg">
                {services.map((service) => (
                  <Link
                    className="block px-3 py-2.5 text-sm text-navy-800 hover:bg-blue-100 hover:text-blue-700"
                    href={`/services/${service.slug}`}
                    key={service.slug}
                    onClick={closeMenus}
                  >
                    {service.title}
                  </Link>
                ))}
                <Link
                  className="mt-1 block border-t border-border px-3 py-3 text-sm font-semibold text-blue-700"
                  href="/services"
                  onClick={closeMenus}
                >
                  All services
                </Link>
              </div>
            ) : null}
          </div>
          {siteConfig.navigation.slice(2).map((item) => (
            <NavLink
              key={item.href}
              active={pathname === item.href || pathname.startsWith(`${item.href}/`)}
              href={item.href}
              onClick={closeMenus}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden lg:block">
          <Link className="button-primary" href="/contact">
            Start a Project
          </Link>
        </div>

        <button
          aria-expanded={mobileOpen}
          aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
          className="grid size-11 place-items-center text-navy-950 hover:bg-blue-100 lg:hidden"
          onClick={() => setMobileOpen((open) => !open)}
          type="button"
        >
          {mobileOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
      </div>

      {mobileOpen ? (
        <nav
          aria-label="Mobile navigation"
          className="border-t border-border bg-white px-6 py-4 lg:hidden"
        >
          <div className="mx-auto flex max-w-7xl flex-col">
            {siteConfig.navigation.slice(0, 2).map((item) => (
              <MobileNavLink
                active={pathname === item.href}
                href={item.href}
                key={item.href}
                onClick={closeMenus}
              >
                {item.label}
              </MobileNavLink>
            ))}
            <button
              aria-expanded={servicesOpen}
              className="flex min-h-12 items-center justify-between border-b border-border text-left text-sm font-medium text-navy-800"
              onClick={() => setServicesOpen((open) => !open)}
              type="button"
            >
              Services <ChevronDown aria-hidden="true" size={16} />
            </button>
            {servicesOpen ? (
              <div className="border-b border-border py-2 pl-4">
                <Link
                  className="block py-2 text-sm font-semibold text-blue-700"
                  href="/services"
                  onClick={closeMenus}
                >
                  All services
                </Link>
                {services.map((service) => (
                  <Link
                    className="block py-2 text-sm text-muted"
                    href={`/services/${service.slug}`}
                    key={service.slug}
                    onClick={closeMenus}
                  >
                    {service.title}
                  </Link>
                ))}
              </div>
            ) : null}
            {siteConfig.navigation.slice(2).map((item) => (
              <MobileNavLink
                active={
                  pathname === item.href || pathname.startsWith(`${item.href}/`)
                }
                href={item.href}
                key={item.href}
                onClick={closeMenus}
              >
                {item.label}
              </MobileNavLink>
            ))}
            <Link
              className="button-primary mt-4 w-full"
              href="/contact"
              onClick={closeMenus}
            >
              Start a Project
            </Link>
          </div>
        </nav>
      ) : null}
    </header>
  );
}

function NavLink({
  href,
  active,
  children,
  onClick,
}: {
  href: string;
  active: boolean;
  children: string;
  onClick: () => void;
}) {
  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={`min-h-11 content-center text-sm font-medium transition-colors hover:text-blue-700 ${active ? "text-blue-700" : "text-navy-800"}`}
      href={href}
      onClick={onClick}
    >
      {children}
    </Link>
  );
}

function MobileNavLink({
  href,
  active,
  children,
  onClick,
}: {
  href: string;
  active: boolean;
  children: string;
  onClick: () => void;
}) {
  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={`flex min-h-12 items-center border-b border-border text-sm font-medium ${active ? "text-blue-700" : "text-navy-800"}`}
      href={href}
      onClick={onClick}
    >
      {children}
    </Link>
  );
}

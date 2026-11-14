"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { defaultNavigation } from "@/config/navigation";
import { navigationConfigurationSchema, type NavigationConfiguration } from "@/lib/validation/site-configuration";

export function SiteShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith("/admin");
  const [navigation, setNavigation] = useState<NavigationConfiguration>(defaultNavigation);

  useEffect(() => {
    if (isAdmin) return;
    const controller = new AbortController();
    async function loadNavigation() {
      try {
        const response = await fetch("/api/v1/site-navigation", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Navigation request failed.");
        const body: unknown = await response.json();
        const data = typeof body === "object" && body !== null && "data" in body
          ? body.data
          : null;
        const parsed = navigationConfigurationSchema.safeParse(data);
        if (!parsed.success) throw new Error("Navigation response is invalid.");
        setNavigation(parsed.data);
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error("Could not load public navigation; using the current navigation.", error);
        }
      }
    }
    void loadNavigation();
    return () => controller.abort();
  }, [isAdmin]);

  if (isAdmin) return children;

  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <Header links={navigation.header} />
      <main id="main-content">{children}</main>
      <Footer links={navigation.footer} />
    </>
  );
}

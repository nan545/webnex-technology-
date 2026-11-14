import { siteConfig } from "@/config/site";
import type { NavigationConfiguration } from "@/lib/validation/site-configuration";

export const defaultNavigation: NavigationConfiguration = {
  header: siteConfig.navigation.map(({ label, href }) => ({ label, href })),
  footer: [
    ...siteConfig.navigation.slice(1).map(({ label, href }) => ({ label, href })),
    { label: "Privacy", href: "/privacy" },
    { label: "Terms", href: "/terms" },
  ],
};

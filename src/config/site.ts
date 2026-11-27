export const siteConfig = {
  name: "WEBNEX Technologies",
  shortName: "WEBNEX",
  tagline: "Building Intelligence. Enabling Progress.",
  description:
    "WEBNEX Technologies delivers digital solutions, enterprise software, cloud infrastructure, AI-powered automation, and technology consulting.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  navigation: [
    { label: "Home", href: "/" },
    { label: "About", href: "/about" },
    { label: "Services", href: "/services" },
    { label: "Products", href: "/products" },
    { label: "Industries", href: "/industries" },
    { label: "Insights", href: "/insights" },
    { label: "Contact", href: "/contact" },
  ],
} as const;

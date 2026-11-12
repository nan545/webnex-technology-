export const siteConfig = {
  name: "WEBNEX Technologies",
  shortName: "WEBNEX",
  tagline: "Engineering Digital Possibilities.",
  description:
    "WEBNEX Technologies delivers software engineering and technology solutions for businesses in Ghana.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  navigation: [
    { label: "Home", href: "/" },
    { label: "About", href: "/about" },
    { label: "Team", href: "/team" },
    { label: "Projects", href: "/projects" },
    { label: "Industries", href: "/industries" },
    { label: "Insights", href: "/insights" },
    { label: "Contact", href: "/contact" },
  ],
} as const;

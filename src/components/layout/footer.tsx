import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { services } from "@/data/services";
import { siteConfig } from "@/config/site";
import { Container } from "@/components/ui/container";

export function Footer() {
  return (
    <footer className="border-t border-border bg-slate-50">
      <Container className="grid gap-12 py-14 md:grid-cols-[1.4fr_1fr_1fr] md:gap-16">
        <div>
          <Link className="text-sm font-bold tracking-[0.14em] text-navy-950" href="/">
            WEBNEX TECHNOLOGIES
          </Link>
          <p className="mt-4 max-w-sm text-sm leading-6 text-muted">
            {siteConfig.tagline} Software engineering and technology solutions
            for businesses in Ghana.
          </p>
        </div>
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-navy-950">
            Explore
          </h2>
          <ul className="mt-4 space-y-3">
            {siteConfig.navigation.slice(1).map((item) => (
              <li key={item.href}>
                <Link
                  className="text-sm text-muted hover:text-blue-700"
                  href={item.href}
                >
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <Link className="text-sm text-muted hover:text-blue-700" href="/privacy">
                Privacy
              </Link>
            </li>
            <li>
              <Link className="text-sm text-muted hover:text-blue-700" href="/terms">
                Terms
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-navy-950">
            Services
          </h2>
          <ul className="mt-4 space-y-3">
            {services.slice(0, 5).map((service) => (
              <li key={service.slug}>
                <Link
                  className="text-sm text-muted hover:text-blue-700"
                  href={`/services/${service.slug}`}
                >
                  {service.title}
                </Link>
              </li>
            ))}
          </ul>
          <Link
            className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-blue-700 hover:text-navy-950"
            href="/services"
          >
            View all services <ArrowUpRight aria-hidden="true" size={15} />
          </Link>
        </div>
      </Container>
      <div className="border-t border-border">
        <Container className="flex flex-col gap-2 py-5 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {siteConfig.name}. All rights reserved.
          </p>
          <p>Serving businesses in Ghana</p>
        </Container>
      </div>
    </footer>
  );
}

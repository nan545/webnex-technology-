import type { Metadata } from "next";
import { CtaSection } from "@/components/ui/cta-section";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { SectionHeading } from "@/components/ui/section-heading";
import { pageMetadata } from "@/lib/seo";
import { serviceContent, serviceDivisions } from "@/data/service-content";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata(
  "Services",
  "Explore WEBNEX Technologies digital solutions, software, cloud infrastructure, AI automation, and technology consulting services.",
  "/services",
);

export default function ServicesPage() {
  return (
    <>
      <PageHero
        description="A connected catalogue of digital, software, infrastructure, automation, and consulting capabilities for organizations in Ghana and international markets."
        eyebrow="Our services"
        title="Technology capabilities organized around business needs."
      />
      {serviceDivisions.map((division, divisionIndex) => {
        const services = serviceContent.filter((service) => service.division === division.title);
        return (
          <section className={divisionIndex % 2 ? "bg-slate-50 py-16 sm:py-20" : "py-16 sm:py-20"} key={division.title}>
            <Container>
              <SectionHeading eyebrow={`Division ${divisionIndex + 1}`} description={division.description} title={division.title} />
              <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {services.map((service) => (
                  <article className="group border border-border bg-white p-6" key={service.slug}>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">Service</p>
                    <h3 className="mt-3 text-lg font-semibold text-navy-950">
                      <Link className="after:absolute after:inset-0" href={`/services/${service.slug}`}>{service.title}</Link>
                    </h3>
                    <p className="mt-3 text-sm leading-6 text-muted">{service.shortDescription}</p>
                    <Link className="relative mt-5 inline-flex items-center gap-1 text-sm font-semibold text-blue-700" href={`/services/${service.slug}`}>
                      View service <ArrowRight aria-hidden="true" size={15} />
                    </Link>
                  </article>
                ))}
              </div>
            </Container>
          </section>
        );
      })}
      <section className="bg-white py-16 sm:py-20">
        <Container className="grid gap-8 lg:grid-cols-[0.7fr_1.3fr]">
          <SectionHeading eyebrow="Next step" title="Scope the work around your real requirement." />
          <div>
            <p className="leading-7 text-muted">Tell us what you need to improve, which users are affected, and how you work today. We will agree scope and next steps before recommending a custom quote or consultation.</p>
          </div>
        </Container>
      </section>
      <CtaSection />
    </>
  );
}

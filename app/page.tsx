import Link from "next/link";
import { ArrowRight, Boxes, Check, CloudCog, CodeXml, Hotel, Layers3, ShieldCheck, Sparkles } from "lucide-react";
import { ButtonLink } from "@/components/ui/button-link";
import { Container } from "@/components/ui/container";
import { CtaSection } from "@/components/ui/cta-section";
import { SectionHeading } from "@/components/ui/section-heading";
import { IndustryCard } from "@/components/industries/industry-card";
import { HeroIllustration } from "@/components/home/hero-illustration";
import { siteConfig } from "@/config/site";
import { industries } from "@/data/industries";
import { products } from "@/data/products";
import { serviceDivisions } from "@/data/service-content";
import { pageMetadata } from "@/lib/seo";
import Image from "next/image";
import { divisionImages } from "@/data/service-images";

export const dynamic = "force-dynamic";

export const metadata = {
  ...pageMetadata(
    "Technology and Innovation for Modern Organizations",
    "WEBNEX Technologies delivers digital solutions, enterprise software, cloud infrastructure, AI automation, and technology consulting in Ghana and international markets.",
    "/",
  ),
  title: { absolute: `${siteConfig.name} | ${siteConfig.tagline}` },
  openGraph: {
    type: "website",
    locale: "en_GH",
    siteName: siteConfig.name,
    title: `${siteConfig.name} | ${siteConfig.tagline}`,
    description: "Digital solutions, enterprise software, cloud infrastructure, AI automation, and technology consulting.",
    url: new URL("/", siteConfig.url),
  },
};

const divisionIcons = [CodeXml, Layers3, CloudCog, Sparkles, ShieldCheck];

const reasons = [
  { title: "Business before technology", text: "Technical decisions begin with the operating need, intended outcome, users, and constraints." },
  { title: "Clear and maintainable delivery", text: "Scope, architecture, responsibilities, and acceptance criteria are documented and reviewed." },
  { title: "Security and quality in scope", text: "Access, privacy, reliability, accessibility, testing, and operational ownership are considered throughout." },
  { title: "Practical for Ghana, ready for growth", text: "We design around local operating realities while supporting international standards and integrations." },
];

export default function Home() {
  return (
    <>
      <section className="border-b border-border bg-white">
        <Container className="grid min-h-[620px] items-center gap-12 py-16 sm:py-20 lg:grid-cols-[1.12fr_0.88fr] lg:py-24">
          <div className="max-w-3xl">
            <p className="mb-6 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">
              <span className="h-px w-8 bg-blue-700" />
              Technology · Innovation · Progress
            </p>
            <h1 className="text-5xl font-semibold leading-[1.03] tracking-[-0.05em] text-navy-950 sm:text-6xl lg:text-7xl">
              Building intelligence. Enabling progress.
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-muted">
              WEBNEX Technologies helps businesses and institutions operate more efficiently through reliable digital solutions, enterprise software, cloud infrastructure, automation, and technology consulting.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/contact">Request a Consultation <ArrowRight aria-hidden="true" size={16} /></ButtonLink>
              <ButtonLink href="/services" variant="secondary">Explore Our Services</ButtonLink>
            </div>
            <p className="mt-10 text-sm font-medium text-navy-800">Ghana first. International in outlook.</p>
          </div>
          <HeroIllustration />
        </Container>
      </section>

      <section className="py-16 sm:py-20">
        <Container className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:gap-20">
          <SectionHeading eyebrow="Who we are" title="Technology with purpose and measurable discipline." />
          <div>
            <p className="text-xl leading-8 text-navy-800">A technology and innovation company delivering digital solutions across web, software, cloud, AI, and consulting.</p>
            <p className="mt-5 leading-7 text-muted">We work with organizations that need dependable systems and a clear path from an operational challenge to an implementable solution. Engagements can range from a focused website to a business application or infrastructure initiative.</p>
            <Link className="mt-6 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-blue-700 hover:text-navy-950" href="/about">
              Learn about WEBNEX <ArrowRight aria-hidden="true" size={16} />
            </Link>
          </div>
        </Container>
      </section>

      <section className="bg-slate-50 py-16 sm:py-20">
        <Container>
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <SectionHeading eyebrow="Our divisions" description="Five connected service divisions for digital transformation, business operations, and technology delivery." title="A complete corporate technology catalogue." />
            <Link className="inline-flex min-h-11 shrink-0 items-center gap-2 text-sm font-semibold text-blue-700" href="/services">View all services <ArrowRight aria-hidden="true" size={16} /></Link>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {serviceDivisions.map((division, index) => {
              const Icon = divisionIcons[index] ?? ShieldCheck;
              const image = divisionImages[division.title];
              return (
                <article className="group border border-border bg-white" key={division.title}>
                  <div className="relative aspect-[16/9] overflow-hidden bg-slate-100">
                    <Image
                      alt={image.alt}
                      className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      src={image.src}
                    />
                  </div>
                  <div className="p-6 sm:p-7">
                    <Icon aria-hidden="true" className="text-blue-700" size={25} />
                    <h2 className="mt-5 text-lg font-semibold text-navy-950">{division.title}</h2>
                    <p className="mt-3 text-sm leading-6 text-muted">{division.description}</p>
                    <Link className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-blue-700" href="/services">
                      Explore division <ArrowRight aria-hidden="true" size={15} />
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        </Container>
      </section>

      <section className="py-16 sm:py-20">
        <Container>
          <div className="grid gap-10 lg:grid-cols-[0.7fr_1.3fr] lg:items-end">
            <SectionHeading eyebrow="Software products" title="Purpose-built software for specific operating needs." />
            <p className="max-w-2xl leading-7 text-muted">Explore WEBNEX product solutions for inventory, sales, hospitality operations, and associated management workflows.</p>
          </div>
          <div className="mt-10 grid gap-5 lg:grid-cols-2">
            {products.map((product) => {
              const Icon = product.slug === "stockflow" ? Boxes : Hotel;
              return (
                <article className="border border-border p-7" key={product.slug}>
                  <span className="grid size-12 place-items-center bg-blue-100 text-blue-700"><Icon aria-hidden="true" size={24} /></span>
                  <p className="mt-6 text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">{product.category}</p>
                  <h3 className="mt-3 text-2xl font-semibold text-navy-950">{product.name}</h3>
                  <p className="mt-3 leading-7 text-muted">{product.description}</p>
                  <Link className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-blue-700" href="/products">
                    Explore product <ArrowRight aria-hidden="true" size={16} />
                  </Link>
                </article>
              );
            })}
          </div>
        </Container>
      </section>

      <section className="bg-slate-50 py-16 sm:py-20">
        <Container>
          <SectionHeading eyebrow="Industries" description="We consider sector-specific users, workflows, constraints, and compliance needs. These are areas of focus, not claimed client engagements." title="Technology shaped around industry context." />
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {industries.filter((industry) => ["education", "hospitality", "retail-and-ecommerce", "restaurants", "professional-services", "smes-startups"].includes(industry.slug)).map((industry) => (
              <IndustryCard industry={industry} key={industry.slug} />
            ))}
          </div>
        </Container>
      </section>

      <section className="py-16 sm:py-20">
        <Container className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
          <SectionHeading eyebrow="Why WEBNEX" title="A disciplined approach to technology delivery." />
          <div className="grid gap-4 sm:grid-cols-2">
            {reasons.map((reason) => (
              <article className="border-t border-border pt-5" key={reason.title}>
                <Check aria-hidden="true" className="text-blue-700" size={18} />
                <h3 className="mt-3 font-semibold text-navy-950">{reason.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted">{reason.text}</p>
              </article>
            ))}
          </div>
        </Container>
      </section>

      <CtaSection />
    </>
  );
}

import Link from "next/link";
import {
  ArrowDownRight,
  ArrowRight,
  Check,
  Compass,
  PenTool,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { ButtonLink } from "@/components/ui/button-link";
import { Container } from "@/components/ui/container";
import { CtaSection } from "@/components/ui/cta-section";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeading } from "@/components/ui/section-heading";
import { IndustryCard } from "@/components/industries/industry-card";
import { PublishedServiceCard } from "@/components/services/published-service-card";
import { siteConfig } from "@/config/site";
import { industries } from "@/data/industries";
import { pageMetadata } from "@/lib/seo";
import { readPublishedServicesForPage } from "@/server/content/services";

export const metadata = {
  ...pageMetadata(
    "Home",
    "WEBNEX Technologies delivers software engineering and technology solutions for businesses in Ghana and beyond.",
    "/",
  ),
  title: {
    absolute: `${siteConfig.name} | ${siteConfig.tagline}`,
  },
  openGraph: {
    type: "website",
    locale: "en_GH",
    siteName: siteConfig.name,
    title: `${siteConfig.name} | ${siteConfig.tagline}`,
    description:
      "WEBNEX Technologies delivers software engineering and technology solutions for businesses in Ghana and beyond.",
    url: new URL("/", siteConfig.url),
  },
};

const principles = [
  "Business goals guide technical decisions.",
  "Security, accessibility, and quality belong in the plan from the start.",
  "Clear architecture helps software remain understandable and maintainable.",
  "Thoughtful design makes complex workflows easier to use.",
];

const process = [
  { title: "Discovery", text: "Understand the people, goals, constraints, and problem." },
  { title: "Planning", text: "Agree on scope, architecture, priorities, and acceptance criteria." },
  { title: "Design", text: "Shape clear, accessible experiences around user needs." },
  { title: "Development", text: "Build in reviewable steps with quality checks throughout." },
  { title: "Testing", text: "Verify core journeys, edge cases, and operational needs." },
  { title: "Launch and support", text: "Plan release, handover, and ongoing ownership." },
];

export const dynamic = "force-dynamic";

export default async function Home() {
  const serviceResult = await readPublishedServicesForPage();
  const services = serviceResult.items;
  return (
    <>
      <section className="relative overflow-hidden border-b border-border bg-white">
        <Container className="grid min-h-[620px] items-center gap-12 py-20 lg:grid-cols-[1.15fr_0.85fr] lg:py-28">
          <div className="max-w-3xl">
            <p className="mb-6 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">
              <span className="h-px w-8 bg-blue-700" />
              Ghana · Global perspective
            </p>
            <h1 className="text-5xl font-semibold leading-[1.06] tracking-[-0.05em] text-navy-950 sm:text-6xl lg:text-7xl">
              Building digital solutions that move businesses forward.
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-muted">
              We design and develop digital products, software systems, and
              technology solutions to help businesses work smarter and grow
              with confidence.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href="/contact">
                Start a Project <ArrowRight aria-hidden="true" size={16} />
              </ButtonLink>
              <ButtonLink href="/services" variant="secondary">
                Explore Our Services
              </ButtonLink>
            </div>
            <p className="mt-10 text-sm font-medium text-navy-800">
              Engineering Digital Possibilities.
            </p>
          </div>
          <div
            aria-hidden="true"
            className="relative mx-auto hidden aspect-square w-full max-w-[440px] items-center justify-center lg:flex"
          >
            <div className="absolute inset-8 border border-blue-100" />
            <div className="absolute inset-16 border border-border" />
            <div className="absolute inset-24 border border-blue-100" />
            <div className="absolute left-1/2 top-8 h-[calc(100%-4rem)] w-px -translate-x-1/2 bg-border" />
            <div className="absolute left-8 top-1/2 h-px w-[calc(100%-4rem)] -translate-y-1/2 bg-border" />
            <div className="relative grid size-32 place-items-center border border-blue-700 bg-white text-4xl font-semibold tracking-[-0.08em] text-navy-950 shadow-[0_20px_70px_rgba(11,31,58,0.12)]">
              W<span className="text-blue-700">N</span>
            </div>
            <div className="absolute right-7 top-16 bg-white px-3 py-2 text-xs font-semibold tracking-wide text-navy-800 shadow-sm">
              Strategy
            </div>
            <div className="absolute bottom-16 left-2 bg-white px-3 py-2 text-xs font-semibold tracking-wide text-navy-800 shadow-sm">
              Engineering
            </div>
            <div className="absolute bottom-8 right-7 bg-white px-3 py-2 text-xs font-semibold tracking-wide text-navy-800 shadow-sm">
              Experience
            </div>
          </div>
        </Container>
        <div className="absolute bottom-8 right-8 hidden text-blue-700 lg:block">
          <ArrowDownRight aria-hidden="true" size={28} strokeWidth={1.4} />
        </div>
      </section>

      <section className="py-20 sm:py-24">
        <Container className="grid gap-10 lg:grid-cols-[0.7fr_1.3fr] lg:gap-20">
          <SectionHeading eyebrow="Who we are" title="Technology with purpose." />
          <div>
            <p className="text-xl leading-8 text-navy-800">
              WEBNEX Technologies is a Ghana-first software engineering
              company with an international outlook.
            </p>
            <p className="mt-5 leading-7 text-muted">
              We work across product thinking, design, software development,
              and technical planning to help businesses address practical
              challenges with digital solutions.
            </p>
            <Link
              className="mt-6 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-blue-700 hover:text-navy-950"
              href="/about"
            >
              Learn about our approach <ArrowRight aria-hidden="true" size={16} />
            </Link>
          </div>
        </Container>
      </section>

      <section className="bg-slate-50 py-20 sm:py-24">
        <Container>
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <SectionHeading
              description="From a focused website to a larger software initiative, explore the areas where we can help."
              eyebrow="What we do"
              title="Technology services for real business needs."
            />
            <Link
              className="inline-flex min-h-11 shrink-0 items-center gap-2 text-sm font-semibold text-blue-700 hover:text-navy-950"
              href="/services"
            >
              All services <ArrowRight aria-hidden="true" size={16} />
            </Link>
          </div>
          {services.length ? (
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {services.slice(0, 6).map((service) => (
                <PublishedServiceCard key={service.id} service={service} />
              ))}
            </div>
          ) : (
            <div className="mt-10">
              <EmptyState
                description={serviceResult.unavailable
                  ? "Published service information is temporarily unavailable because the content database could not be reached."
                  : "No services have been published yet."}
                title={serviceResult.unavailable
                  ? "Service information is temporarily unavailable"
                  : "Service information is being prepared"}
              />
            </div>
          )}
        </Container>
      </section>

      <section className="py-20 sm:py-24">
        <Container className="grid gap-12 lg:grid-cols-2 lg:gap-20">
          <div>
            <SectionHeading
              eyebrow="How we think"
              title="Good engineering starts with the right questions."
            />
            <p className="mt-5 max-w-xl leading-7 text-muted">
              Our working principles keep decisions grounded in the people
              using the product and the teams responsible for it.
            </p>
            <ul className="mt-8 space-y-4">
              {principles.map((principle) => (
                <li className="flex gap-3 text-sm leading-6 text-navy-800" key={principle}>
                  <Check
                    aria-hidden="true"
                    className="mt-0.5 shrink-0 text-blue-700"
                    size={18}
                  />
                  {principle}
                </li>
              ))}
            </ul>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <PrincipleCard
              icon={Compass}
              title="Business-focused"
              text="Start with the problem and intended outcomes before selecting a technical approach."
            />
            <PrincipleCard
              icon={PenTool}
              title="Human-centred"
              text="Make clarity, accessibility, and user needs part of the design process."
            />
            <PrincipleCard
              icon={ShieldCheck}
              title="Security-conscious"
              text="Consider data, access, and operational risks as requirements take shape."
            />
            <PrincipleCard
              icon={Wrench}
              title="Built to maintain"
              text="Favor understandable systems with explicit ownership and quality practices."
            />
          </div>
        </Container>
      </section>

      <section className="bg-slate-50 py-20 sm:py-24">
        <Container>
          <SectionHeading
            description="We are interested in the distinct needs of each sector. These are areas of focus, not a list of claimed clients."
            eyebrow="Areas of focus"
            title="Technology shaped around the industry."
          />
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {industries.map((industry) => (
              <IndustryCard industry={industry} key={industry.slug} />
            ))}
          </div>
        </Container>
      </section>

      <section className="py-20 sm:py-24">
        <Container>
          <SectionHeading
            description="A considered, collaborative path from understanding the need to supporting the result."
            eyebrow="How we work"
            title="A clear path from idea to delivery."
          />
          <ol className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {process.map((step, index) => (
              <li className="border-t border-border pt-5" key={step.title}>
                <span className="text-xs font-semibold tracking-[0.15em] text-blue-700">
                  0{index + 1}
                </span>
                <h3 className="mt-3 text-lg font-semibold text-navy-950">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-muted">{step.text}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      <section className="bg-slate-50 py-20 sm:py-24">
        <Container>
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <SectionHeading
              description="We will share project work here when approved case studies are available."
              eyebrow="Selected work"
              title="Projects and case studies."
            />
            <Link
              className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-blue-700 hover:text-navy-950"
              href="/projects"
            >
              Explore projects <ArrowRight aria-hidden="true" size={16} />
            </Link>
          </div>
          <div className="mt-8">
            <EmptyState
              description="No approved projects have been published yet. We do not present demonstration work as completed client engagements."
              title="Portfolio details are being prepared"
            />
          </div>
        </Container>
      </section>

      <section className="py-20 sm:py-24">
        <Container className="grid items-center gap-8 lg:grid-cols-[1fr_auto]">
          <div>
            <SectionHeading
              description="When approved editorial content is ready, it will be published in Insights."
              eyebrow="Ideas and perspectives"
              title="Insights from the work of building digital products."
            />
          </div>
          <ButtonLink href="/insights" variant="secondary">
            Browse Insights <ArrowRight aria-hidden="true" size={16} />
          </ButtonLink>
        </Container>
      </section>

      <CtaSection />
    </>
  );
}

function PrincipleCard({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof Compass;
  title: string;
  text: string;
}) {
  return (
    <article className="border border-border p-6">
      <Icon aria-hidden="true" className="text-blue-700" size={24} strokeWidth={1.7} />
      <h3 className="mt-5 font-semibold text-navy-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted">{text}</p>
    </article>
  );
}

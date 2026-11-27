import type { Metadata } from "next";
import { ArrowRight, Eye, Goal, Shield, Sparkles } from "lucide-react";
import { ButtonLink } from "@/components/ui/button-link";
import { Container } from "@/components/ui/container";
import { CtaSection } from "@/components/ui/cta-section";
import { PageHero } from "@/components/ui/page-hero";
import { SectionHeading } from "@/components/ui/section-heading";
import { TeamSection } from "@/components/team/team-section";
import { pageMetadata } from "@/lib/seo";
import { readPublishedTeamMembers } from "@/server/content/team";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata(
  "About",
  "Learn about WEBNEX Technologies, a technology and innovation company delivering digital solutions, software, cloud infrastructure, AI automation, and consulting.",
  "/about",
);

const principles = [
  {
    icon: Goal,
    title: "Purpose before technology",
    text: "Understand the business need and intended outcome before choosing how to build.",
  },
  {
    icon: Eye,
    title: "Clarity for people",
    text: "Design systems and experiences that are understandable, inclusive, and usable.",
  },
  {
    icon: Shield,
    title: "Responsible engineering",
    text: "Consider security, privacy, accessibility, and maintainability throughout delivery.",
  },
  {
    icon: Sparkles,
    title: "Continuous learning",
    text: "Treat technology choices as decisions that should be reviewed against changing needs.",
  },
];

export default async function AboutPage() {
  const team = await readPublishedTeamMembers();
  return (
    <>
      <PageHero
        description="A Ghana-first technology and innovation company with an international outlook."
        eyebrow="About WEBNEX"
        title="Reliable technology for better ways of working."
        image={{ src: "/images/consulting.webp", alt: "Technology consultants in a planning session" }}
      />
      <section className="py-16 sm:py-20">
        <Container className="grid gap-10 lg:grid-cols-[0.75fr_1.25fr] lg:gap-20">
          <SectionHeading eyebrow="Our focus" title="Technology should solve a real problem." />
          <div className="space-y-5 leading-7 text-muted">
            <p>
              WEBNEX Technologies delivers digital solutions, enterprise
              software, cloud infrastructure, AI-powered automation, and
              technology consulting for businesses and institutions.
            </p>
            <p>
              Our work begins with understanding the people involved, the
              constraints that matter, and what a useful operating outcome
              would look like. The solution should fit the need—not the other way around.
            </p>
            <p>
              The company&apos;s primary market is Ghana, with an international
              outlook for organizations, partners, and technology projects.
            </p>
          </div>
        </Container>
      </section>
      <section className="bg-slate-50 py-16 sm:py-20">
        <Container>
          <SectionHeading
            description="These working principles guide how we approach product and engineering decisions."
            eyebrow="How we work"
            title="A considered approach to technology."
          />
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {principles.map(({ icon: Icon, title, text }) => (
              <article className="border border-border bg-white p-6" key={title}>
                <Icon aria-hidden="true" className="text-blue-700" size={24} />
                <h3 className="mt-5 font-semibold text-navy-950">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-muted">{text}</p>
              </article>
            ))}
          </div>
        </Container>
      </section>
      <TeamSection members={team.items} unavailable={team.unavailable} />
      <section className="py-16 sm:py-20">
        <Container className="grid gap-8 lg:grid-cols-2">
          <div className="border-l-2 border-blue-700 pl-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
              Our purpose
            </p>
            <h2 className="mt-4 text-2xl font-semibold text-navy-950">
              Building Intelligence. Enabling Progress.
            </h2>
            <p className="mt-3 leading-7 text-muted">
              The approved tagline reflects WEBNEX Technologies’ focus on
              helping businesses explore and build useful digital solutions.
            </p>
          </div>
          <div className="border-l-2 border-border pl-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
              Mission and vision
            </p>
            <h2 className="mt-4 text-2xl font-semibold text-navy-950">Mission</h2>
            <p className="mt-3 leading-7 text-muted">
              Help businesses and institutions operate more efficiently through reliable and intelligent technology.
            </p>
            <h2 className="mt-6 text-2xl font-semibold text-navy-950">Vision</h2>
            <p className="mt-3 leading-7 text-muted">
              Enable organizations to adopt dependable, intelligent technology that strengthens how they operate and grow.
            </p>
          </div>
        </Container>
      </section>
      <section className="bg-slate-50 py-12">
        <Container className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-xl font-semibold text-navy-950">
              Areas of industry focus
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              Explore the sectors WEBNEX aims to serve. These areas do not
              represent verified client engagements.
            </p>
          </div>
          <ButtonLink href="/industries" variant="secondary">
            Explore industries <ArrowRight aria-hidden="true" size={16} />
          </ButtonLink>
        </Container>
      </section>
      <section className="border-y border-border bg-slate-50 py-12">
        <Container className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-xl font-semibold text-navy-950">
              Explore the work we can do together.
            </h2>
            <p className="mt-2 text-sm text-muted">
              Browse our services or tell us what you are planning.
            </p>
          </div>
          <ButtonLink href="/services" variant="secondary">
            Explore services <ArrowRight aria-hidden="true" size={16} />
          </ButtonLink>
        </Container>
      </section>
      <CtaSection />
    </>
  );
}

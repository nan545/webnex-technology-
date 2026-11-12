import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";
import { ButtonLink } from "@/components/ui/button-link";
import { Container } from "@/components/ui/container";
import { CtaSection } from "@/components/ui/cta-section";
import { PageHero } from "@/components/ui/page-hero";
import { SectionHeading } from "@/components/ui/section-heading";
import { getIndustry, industries } from "@/data/industries";
import { services } from "@/data/services";
import { pageMetadata } from "@/lib/seo";

export function generateStaticParams() {
  return industries.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/industries/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const industry = getIndustry(slug);
  if (!industry) return { title: "Industry not found" };
  return pageMetadata(
    industry.title,
    industry.introduction,
    `/industries/${industry.slug}`,
  );
}

export default async function IndustryDetailPage({
  params,
}: PageProps<"/industries/[slug]">) {
  const { slug } = await params;
  const industry = getIndustry(slug);
  if (!industry) notFound();

  return (
    <>
      <PageHero
        description={industry.introduction}
        eyebrow="Areas of focus"
        title={industry.title}
      />
      <section className="py-16 sm:py-20">
        <Container className="grid gap-12 lg:grid-cols-2 lg:gap-20">
          <div>
            <SectionHeading eyebrow="Common challenges" title="Problems worth understanding." />
            <ul className="mt-7 space-y-4">
              {industry.challenges.map((challenge) => (
                <li className="flex gap-3 text-sm leading-6 text-muted" key={challenge}>
                  <Check aria-hidden="true" className="mt-0.5 shrink-0 text-blue-700" size={17} />
                  {challenge}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <SectionHeading eyebrow="Possible solutions" title="Technology that fits the context." />
            <ul className="mt-7 space-y-4">
              {industry.solutions.map((solution) => (
                <li className="flex gap-3 text-sm leading-6 text-muted" key={solution}>
                  <Check aria-hidden="true" className="mt-0.5 shrink-0 text-blue-700" size={17} />
                  {solution}
                </li>
              ))}
            </ul>
          </div>
        </Container>
      </section>
      <section className="bg-slate-50 py-16 sm:py-20">
        <Container>
          <SectionHeading eyebrow="Related capabilities" title="Services to explore." />
          <div className="mt-8 flex flex-wrap gap-3">
            {services.slice(0, 4).map((service) => (
              <Link
                className="inline-flex min-h-11 items-center gap-2 border border-border bg-white px-4 text-sm font-medium text-navy-800 hover:border-blue-700 hover:text-blue-700"
                href={`/services/${service.slug}`}
                key={service.slug}
              >
                {service.title} <ArrowRight aria-hidden="true" size={14} />
              </Link>
            ))}
          </div>
          <p className="mt-6 max-w-2xl text-sm leading-6 text-muted">
            These are general areas to explore, not a proposal for a specific
            organization. Requirements and suitable technologies depend on
            each project.
          </p>
          <ButtonLink className="mt-7" href="/contact">
            Discuss your needs <ArrowRight aria-hidden="true" size={16} />
          </ButtonLink>
        </Container>
      </section>
      <CtaSection />
    </>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Check } from "lucide-react";
import { Container } from "@/components/ui/container";
import { CtaSection } from "@/components/ui/cta-section";
import { PageHero } from "@/components/ui/page-hero";
import { caseStudies, getCaseStudy } from "@/data/projects";
import { pageMetadata } from "@/lib/seo";

export function generateStaticParams() {
  return caseStudies.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/case-studies/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const caseStudy = getCaseStudy(slug);
  if (!caseStudy) return { title: "Case study not found" };
  return pageMetadata(
    caseStudy.title,
    caseStudy.challenge,
    `/case-studies/${caseStudy.slug}`,
  );
}

export default async function CaseStudyPage({
  params,
}: PageProps<"/case-studies/[slug]">) {
  const { slug } = await params;
  const caseStudy = getCaseStudy(slug);
  if (!caseStudy) notFound();

  return (
    <>
      <PageHero
        description={caseStudy.challenge}
        eyebrow={caseStudy.clientName ?? "Case study"}
        title={caseStudy.title}
      />
      <section className="py-16 sm:py-20">
        <Container className="grid max-w-6xl gap-12 lg:grid-cols-2">
          <div className="space-y-10">
            <ContentSection title="The challenge" text={caseStudy.challenge} />
            <div>
              <h2 className="text-lg font-semibold text-navy-950">
                Project objectives
              </h2>
              <ul className="mt-4 space-y-3">
                {caseStudy.objectives.map((objective) => (
                  <li className="flex gap-3 text-sm leading-6 text-muted" key={objective}>
                    <Check aria-hidden="true" className="mt-0.5 shrink-0 text-blue-700" size={17} />
                    {objective}
                  </li>
                ))}
              </ul>
            </div>
            <ContentSection title="The solution" text={caseStudy.solution} />
          </div>
          <div className="space-y-10">
            <div>
              <h2 className="text-lg font-semibold text-navy-950">
                Implementation approach
              </h2>
              <ol className="mt-4 space-y-3">
                {caseStudy.approach.map((step, index) => (
                  <li className="flex gap-3 text-sm leading-6 text-muted" key={step}>
                    <span className="font-semibold text-blue-700">
                      0{index + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-navy-950">
                Technology
              </h2>
              <p className="mt-3 text-sm leading-6 text-muted">
                {caseStudy.technologies.join(", ")}
              </p>
            </div>
            <ContentSection
              title="Verified outcome"
              text={caseStudy.verifiedOutcome}
            />
          </div>
        </Container>
      </section>
      <CtaSection />
    </>
  );
}

function ContentSection({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-navy-950">{title}</h2>
      <p className="mt-3 text-sm leading-7 text-muted">{text}</p>
    </div>
  );
}

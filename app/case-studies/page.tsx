import type { Metadata } from "next";
import { CtaSection } from "@/components/ui/cta-section";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHero } from "@/components/ui/page-hero";
import { pageMetadata } from "@/lib/seo";
import { caseStudies } from "@/data/projects";
import Link from "next/link";

export const metadata: Metadata = pageMetadata(
  "Case Studies",
  "Read verified WEBNEX Technologies case studies when approved project outcomes are available.",
  "/case-studies",
);

export default function CaseStudiesPage() {
  return (
    <>
      <PageHero
        description="Case studies should explain the challenge, solution, and verified outcome. We will publish them only when the facts and permissions are confirmed."
        eyebrow="Case studies"
        title="Real project context, not invented outcomes."
      />
      <section className="py-16 sm:py-20">
        <Container>
          {caseStudies.length === 0 ? (
            <EmptyState
              description="There are no approved case studies to publish at this time. No client results, savings, or performance claims have been fabricated."
              title="Approved case studies are not yet available"
            />
          ) : (
            <div className="grid gap-5 md:grid-cols-2">
              {caseStudies.map((caseStudy) => (
                <article className="border border-border p-6" key={caseStudy.slug}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                    Case study
                  </p>
                  <h2 className="mt-3 text-xl font-semibold text-navy-950">
                    <Link href={`/case-studies/${caseStudy.slug}`}>
                      {caseStudy.title}
                    </Link>
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-muted">
                    {caseStudy.challenge}
                  </p>
                </article>
              ))}
            </div>
          )}
        </Container>
      </section>
      <CtaSection />
    </>
  );
}

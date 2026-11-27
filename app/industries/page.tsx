import type { Metadata } from "next";
import { CtaSection } from "@/components/ui/cta-section";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { IndustryCard } from "@/components/industries/industry-card";
import { industries } from "@/data/industries";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata(
  "Industries",
  "Explore business sectors WEBNEX Technologies aims to serve with thoughtful software and digital solutions.",
  "/industries",
);

export default function IndustriesPage() {
  return (
    <>
      <PageHero
        description="Every sector has different users, workflows, and constraints. These are areas of interest—not claims of existing client engagements."
        eyebrow="Industries"
        title="Digital solutions shaped around sector needs."
        image={{ src: "/images/office.webp", alt: "Professional team collaborating in a modern office" }}
      />
      <section className="py-16 sm:py-20">
        <Container className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {industries.map((industry) => (
            <IndustryCard industry={industry} key={industry.slug} />
          ))}
        </Container>
      </section>
      <CtaSection />
    </>
  );
}

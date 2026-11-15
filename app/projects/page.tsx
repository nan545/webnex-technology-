import type { Metadata } from "next";
import { CtaSection } from "@/components/ui/cta-section";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHero } from "@/components/ui/page-hero";
import { pageMetadata } from "@/lib/seo";
import { ProjectGrid } from "@/components/projects/project-grid";
import { readWebsiteProjects } from "@/server/content/website-publications";

export const metadata: Metadata = pageMetadata(
  "Projects",
  "Explore approved WEBNEX Technologies project work and case studies when they are available.",
  "/projects",
);

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const { items: projects, unavailable } = await readWebsiteProjects();
  return (
    <>
      <PageHero
        description="Explore approved project work from WEBNEX Technologies."
        eyebrow="Projects"
        title="Work worth sharing, presented with context."
      />
      <section className="py-16 sm:py-20">
        <Container>
          {unavailable ? <p role="status">Projects are temporarily unavailable. Please try again later.</p> : projects.length === 0 ? (
            <EmptyState
              description="No approved portfolio projects are available for publication yet. We do not invent client engagements or present demonstrations as completed work."
              title="Project stories are being prepared"
            />
          ) : (
            <ProjectGrid projects={projects} />
          )}
        </Container>
      </section>
      <CtaSection />
    </>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import { ArrowRight, Check } from "lucide-react";
import { ButtonLink } from "@/components/ui/button-link";
import { Container } from "@/components/ui/container";
import { CtaSection } from "@/components/ui/cta-section";
import { PageHero } from "@/components/ui/page-hero";
import { getProject, projects } from "@/data/projects";
import { pageMetadata } from "@/lib/seo";

export function generateStaticParams() {
  return projects.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/projects/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) return { title: "Project not found" };
  return pageMetadata(
    project.title,
    project.summary,
    `/projects/${project.slug}`,
  );
}

export default async function ProjectDetailPage({
  params,
}: PageProps<"/projects/[slug]">) {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) notFound();

  return (
    <>
      <PageHero
        description={project.summary}
        eyebrow={project.industry}
        title={project.title}
      />
      <section className="py-16 sm:py-20">
        <Container className="max-w-4xl">
          {project.image ? (
            <Image
              alt={project.image.alt}
              className="mb-10 aspect-video w-full object-cover"
              height={675}
              sizes="(max-width: 768px) 100vw, 896px"
              src={project.image.src}
              width={1200}
            />
          ) : null}
          <div className="grid gap-8 sm:grid-cols-2">
            {project.description.map((paragraph) => (
              <p className="leading-7 text-muted" key={paragraph}>
                {paragraph}
              </p>
            ))}
          </div>
          <h2 className="mt-10 text-lg font-semibold text-navy-950">
            Technologies
          </h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {project.technologies.map((technology) => (
              <li
                className="border border-border px-3 py-2 text-sm text-navy-800"
                key={technology}
              >
                {technology}
              </li>
            ))}
          </ul>
          <p className="mt-8 flex gap-2 text-sm leading-6 text-muted">
            <Check aria-hidden="true" className="mt-0.5 shrink-0 text-blue-700" size={17} />
            This project information is published from approved portfolio content.
          </p>
          <ButtonLink className="mt-8" href="/contact">
            Discuss a project <ArrowRight aria-hidden="true" size={16} />
          </ButtonLink>
        </Container>
      </section>
      <CtaSection />
    </>
  );
}

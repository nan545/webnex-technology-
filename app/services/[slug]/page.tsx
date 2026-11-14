import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { PublishedServiceCard } from "@/components/services/published-service-card";
import { ButtonLink } from "@/components/ui/button-link";
import { Container } from "@/components/ui/container";
import { CtaSection } from "@/components/ui/cta-section";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHero } from "@/components/ui/page-hero";
import { SectionHeading } from "@/components/ui/section-heading";
import { pageMetadata } from "@/lib/seo";
import { readPublishedServiceForPage, readPublishedServicesForPage } from "@/server/content/services";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/services/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const { service, unavailable } = await readPublishedServiceForPage(slug);
  if (unavailable && !service) return { title: "Service temporarily unavailable", robots: { index: false, follow: true } };
  if (!service) return { title: "Service not found" };
  return pageMetadata(
    service.seoTitle ?? service.title,
    service.seoDescription ?? service.summary ?? "",
    `/services/${service.slug}`,
  );
}

export default async function ServiceDetailPage({
  params,
}: PageProps<"/services/[slug]">) {
  const { slug } = await params;
  const result = await readPublishedServiceForPage(slug);
  if (result.unavailable && !result.service) {
    return (
      <section className="py-16 sm:py-20">
        <Container>
          <EmptyState
            title="Service information is temporarily unavailable"
            description="We cannot load this service right now. Please try again later."
          />
          <Link className="mt-6 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-blue-700 hover:text-navy-950" href="/services">
            <ArrowLeft aria-hidden="true" size={15} /> All services
          </Link>
        </Container>
      </section>
    );
  }
  if (result.redirectSlug) permanentRedirect(`/services/${result.redirectSlug}`);
  const service = result.service;
  if (!service) notFound();

  const content = service.content;
  const relatedResult = await readPublishedServicesForPage();
  const related = relatedResult.items
    .filter((item) => item.slug !== service.slug)
    .slice(0, 3);

  return (
    <>
      <PageHero
        description={service.summary ?? content.introduction}
        eyebrow="Our services"
        title={service.title}
      />
      {content.introduction || content.problems.length ? (
        <section className="py-16 sm:py-20">
          <Container className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
            <div>
              <SectionHeading eyebrow="The opportunity" title="Start with the problem to solve." />
              <p className="mt-5 leading-7 text-muted">{content.introduction}</p>
              <ButtonLink className="mt-7" href="/contact">
                Discuss a project <ArrowRight aria-hidden="true" size={16} />
              </ButtonLink>
            </div>
            {content.problems.length ? (
              <div className="border border-border p-6 sm:p-8">
                <h2 className="text-lg font-semibold text-navy-950">Challenges this service can address</h2>
                <ul className="mt-5 space-y-4">
                  {content.problems.map((problem) => (
                    <li className="flex gap-3 text-sm leading-6 text-muted" key={problem}>
                      <Check aria-hidden="true" className="mt-0.5 shrink-0 text-blue-700" size={17} />
                      {problem}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Container>
        </section>
      ) : null}
      {content.capabilities.length || content.delivery ? (
        <section className="bg-slate-50 py-16 sm:py-20">
          <Container className="grid gap-10 lg:grid-cols-2 lg:gap-20">
            {content.capabilities.length ? (
              <div>
                <SectionHeading eyebrow="Capabilities" title="What the work can include." />
                <ul className="mt-7 space-y-4">
                  {content.capabilities.map((capability) => (
                    <li className="flex gap-3 text-sm leading-6 text-navy-800" key={capability}>
                      <Check aria-hidden="true" className="mt-0.5 shrink-0 text-blue-700" size={17} />
                      {capability}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {content.delivery ? (
              <div>
                <SectionHeading eyebrow="Delivery approach" title="Clear steps. Shared understanding." />
                <p className="mt-5 leading-7 text-muted">{content.delivery}</p>
              </div>
            ) : null}
          </Container>
        </section>
      ) : null}
      {content.faqs.length ? (
        <section className="py-16 sm:py-20">
          <Container>
            <SectionHeading eyebrow="Frequently asked questions" title="Questions about this service." />
            <div className="mt-8 divide-y divide-border border-y border-border">
              {content.faqs.map((faq) => (
                <details className="group py-5" key={faq.question}>
                  <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-5 font-semibold text-navy-950 marker:hidden">
                    {faq.question}
                    <span aria-hidden="true" className="text-xl font-normal text-blue-700 group-open:rotate-45">+</span>
                  </summary>
                  <p className="max-w-3xl pb-2 pr-8 leading-7 text-muted">{faq.answer}</p>
                </details>
              ))}
            </div>
          </Container>
        </section>
      ) : null}
      <section className="py-16 sm:py-20">
        <Container>
          <div className="flex items-center justify-between gap-4">
            <SectionHeading eyebrow="Related services" title="Connected capabilities." />
            <Link className="hidden items-center gap-2 text-sm font-semibold text-blue-700 hover:text-navy-950 sm:flex" href="/services">
              <ArrowLeft aria-hidden="true" size={15} /> All services
            </Link>
          </div>
          {related.length ? (
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {related.map((item) => <PublishedServiceCard key={item.id} service={item} />)}
            </div>
          ) : (
            <div className="mt-8">
              <EmptyState
                description={relatedResult.unavailable
                  ? "Related service information is temporarily unavailable."
                  : "Additional service information will be published here when ready."}
                title={relatedResult.unavailable
                  ? "Related services are temporarily unavailable"
                  : "More services are being prepared"}
              />
            </div>
          )}
        </Container>
      </section>
      <CtaSection />
    </>
  );
}

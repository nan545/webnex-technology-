import type { Metadata } from "next";
import { CtaSection } from "@/components/ui/cta-section";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { EmptyState } from "@/components/ui/empty-state";
import { PublishedServiceCard } from "@/components/services/published-service-card";
import { readPublishedServicesForPage } from "@/server/content/services";
import { pageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata(
  "Services",
  "Explore WEBNEX Technologies services in software engineering, digital product design, and technology planning.",
  "/services",
);

export default async function ServicesPage() {
  const serviceResult = await readPublishedServicesForPage();
  const services = serviceResult.items;
  return (
    <>
      <PageHero
        description="A connected set of engineering and design capabilities to help turn business needs into practical digital solutions."
        eyebrow="Our services"
        title="The right technology starts with the right problem."
      />
      <section className="py-16 sm:py-20">
        <Container>
          {services.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {services.map((service) => (
                <PublishedServiceCard key={service.id} service={service} />
              ))}
            </div>
          ) : (
            <EmptyState
              description={serviceResult.unavailable
                ? "Published service information is temporarily unavailable because the content database could not be reached."
                : "No services have been published yet."}
              title={serviceResult.unavailable
                ? "Service information is temporarily unavailable"
                : "Service information is being prepared"}
            />
          )}
        </Container>
      </section>
      <CtaSection />
    </>
  );
}

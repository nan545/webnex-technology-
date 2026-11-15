import type { Metadata } from "next";
import { ArticleSearch } from "@/components/insights/article-search";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { readWebsiteInsights } from "@/server/content/website-publications";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata(
  "Insights",
  "Perspectives on software engineering, digital products, and technology from WEBNEX Technologies.",
  "/insights",
);

export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  const { items: articles, unavailable } = await readWebsiteInsights();
  return (
    <>
      <PageHero
        description="Articles and perspectives on building useful digital products."
        eyebrow="Insights"
        title="Ideas for building useful digital products."
      />
      <section className="py-16 sm:py-20">
        <Container>
          {unavailable ? <p role="status">Insights are temporarily unavailable. Please try again later.</p> : <ArticleSearch articles={articles} />}
        </Container>
      </section>
    </>
  );
}

import type { Metadata } from "next";
import { ArticleSearch } from "@/components/insights/article-search";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { articles } from "@/data/articles";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata(
  "Insights",
  "Perspectives on software engineering, digital products, and technology from WEBNEX Technologies.",
  "/insights",
);

export default function InsightsPage() {
  return (
    <>
      <PageHero
        description="Articles and perspectives will be published here when editorial content has been reviewed and approved."
        eyebrow="Insights"
        title="Ideas for building useful digital products."
      />
      <section className="py-16 sm:py-20">
        <Container>
          <ArticleSearch articles={articles} />
        </Container>
      </section>
    </>
  );
}

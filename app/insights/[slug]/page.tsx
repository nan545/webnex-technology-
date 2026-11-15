import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import { Container } from "@/components/ui/container";
import { CtaSection } from "@/components/ui/cta-section";
import { PageHero } from "@/components/ui/page-hero";
import { readWebsiteInsights } from "@/server/content/website-publications";
import { pageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/insights/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const { items } = await readWebsiteInsights();
  const article = items.find((item) => item.slug === slug);
  if (!article) return { title: "Article not found" };
  return pageMetadata(
    article.title,
    article.excerpt,
    `/insights/${article.slug}`,
  );
}

export default async function ArticleDetailPage({
  params,
}: PageProps<"/insights/[slug]">) {
  const { slug } = await params;
  const { items, unavailable } = await readWebsiteInsights();
  if (unavailable) throw new Error("Insights are temporarily unavailable.");
  const article = items.find((item) => item.slug === slug);
  if (!article) notFound();

  return (
    <>
      <PageHero
        description={article.excerpt}
        eyebrow={article.category}
        title={article.title}
      />
      <article className="py-16 sm:py-20">
        <Container className="max-w-3xl">
          <p className="mb-10 text-sm text-muted">
            {new Date(article.publishedAt).toLocaleDateString("en-GH")} ·{" "}
            {article.readingMinutes} min read{article.author ? ` · ${article.author}` : ""}
          </p>
          {article.image ? <Image alt={article.image.alt} className="mb-10 w-full object-cover" height={675} src={article.image.src} unoptimized width={1200} /> : null}
          <div className="space-y-6">
            {article.content.map((paragraph) => (
              <p className="text-base leading-8 text-navy-800" key={paragraph}>
                {paragraph}
              </p>
            ))}
          </div>
        </Container>
      </article>
      <CtaSection />
    </>
  );
}

import "server-only";
import type { Article } from "@/data/articles";
import type { Project } from "@/data/projects";
import { publicationContentSchema } from "@/lib/validation/publication";
import { readWithDatabaseFallback } from "@/server/content/database-fallback";
import { prisma } from "@/server/db";

function published() {
  return { status: "PUBLISHED" as const, publishedAt: { lte: new Date() } };
}

export async function readWebsiteProjects() {
  const result = await readWithDatabaseFallback(async () => {
    const records = await prisma.project.findMany({
      where: published(), orderBy: { publishedAt: "desc" },
      select: { id: true, title: true, slug: true, summary: true, content: true, coverImage: { select: { id: true, altText: true } } },
    });
    return records.flatMap((record): Project[] => {
      const parsed = publicationContentSchema.safeParse(record.content);
      if (!parsed.success) {
        console.error("Published project has unsupported content", { id: record.id });
        return [];
      }
      const content = parsed.data;
      return [{
        title: record.title, slug: record.slug, summary: record.summary ?? "",
        industry: content.category, technologies: content.technologies.split(",").map((item) => item.trim()).filter(Boolean),
        description: content.body.split(/\n\s*\n/).map((item) => item.trim()).filter(Boolean),
        ...(record.coverImage ? { image: { src: `/api/v1/publication-images/${record.coverImage.id}`, alt: record.coverImage.altText } } : {}),
      }];
    });
  }, () => [] as Project[], "Published projects");
  return { items: result.value, unavailable: result.unavailable };
}

export async function readWebsiteInsights() {
  const result = await readWithDatabaseFallback(async () => {
    const records = await prisma.blogPost.findMany({
      where: published(), orderBy: { publishedAt: "desc" },
      select: { id: true, title: true, slug: true, excerpt: true, content: true, publishedAt: true, author: { select: { name: true } }, coverImage: { select: { id: true, altText: true } } },
    });
    return records.flatMap((record): Article[] => {
      const parsed = publicationContentSchema.safeParse(record.content);
      if (!parsed.success) {
        console.error("Published insight has unsupported content", { id: record.id });
        return [];
      }
      const content = parsed.data;
      if (!record.publishedAt) throw new Error(`Published insight has no publication date: ${record.id}`);
      return [{
        title: record.title, slug: record.slug, excerpt: record.excerpt ?? "",
        category: content.category, publishedAt: record.publishedAt.toISOString(),
        author: record.author?.name ?? "", readingMinutes: Math.max(1, Math.ceil(content.body.split(/\s+/).length / 200)),
        content: content.body.split(/\n\s*\n/).map((item) => item.trim()).filter(Boolean),
        ...(record.coverImage ? { image: { src: `/api/v1/publication-images/${record.coverImage.id}`, alt: record.coverImage.altText } } : {}),
      }];
    });
  }, () => [] as Article[], "Published insights");
  return { items: result.value, unavailable: result.unavailable };
}

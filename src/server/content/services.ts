import "server-only";
import { ContentStatus } from "@/generated/prisma/client";
import { fallbackServices } from "@/data/fallback/services";
import { cmsServiceContentSchema } from "@/lib/validation/cms-service";
import { readWithDatabaseFallback } from "@/server/content/database-fallback";
import { prisma } from "@/server/db";

export async function listPublishedServicesForWebsite() {
  const services = await prisma.service.findMany({
    where: { status: ContentStatus.PUBLISHED, publishedAt: { lte: new Date() } },
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    select: { id: true, slug: true, title: true, summary: true, content: true, seoTitle: true, seoDescription: true },
  });
  if (services.length === 0) return fallbackServices;
  return services.map((service) => ({
    ...service,
    content: parseServiceContent(service.id, service.content),
  }));
}

export async function readPublishedServicesForPage() {
  const result = await readWithDatabaseFallback(
    listPublishedServicesForWebsite,
    () => fallbackServices,
    "Published services",
  );
  return { items: result.value, unavailable: result.unavailable };
}

export async function readPublishedServiceForPage(slug: string) {
  const result = await readWithDatabaseFallback(
    () => getPublishedServiceForWebsite(slug),
    () => ({ service: fallbackServices.find((service) => service.slug === slug) ?? null, redirectSlug: null }),
    "Service details",
  );
  return { ...result.value, unavailable: result.unavailable };
}

export async function getPublishedServiceForWebsite(slug: string) {
  const service = await prisma.service.findFirst({
    where: { slug, status: ContentStatus.PUBLISHED, publishedAt: { lte: new Date() } },
    select: { id: true, slug: true, title: true, summary: true, content: true, seoTitle: true, seoDescription: true },
  });
  if (service) return { service: { ...service, content: parseServiceContent(service.id, service.content) }, redirectSlug: null };

  const oldSlug = await prisma.serviceRedirect.findUnique({
    where: { sourceSlug: slug },
    select: { service: { select: { id: true, slug: true, status: true, publishedAt: true } } },
  });
  if (
    oldSlug?.service.status === ContentStatus.PUBLISHED &&
    oldSlug.service.publishedAt &&
    oldSlug.service.publishedAt <= new Date()
  ) {
    return { service: null, redirectSlug: oldSlug.service.slug };
  }
  const anyPublishedService = await prisma.service.findFirst({
    where: { status: ContentStatus.PUBLISHED, publishedAt: { lte: new Date() } },
    select: { id: true },
  });
  if (!anyPublishedService) {
    return {
      service: fallbackServices.find((item) => item.slug === slug) ?? null,
      redirectSlug: null,
    };
  }
  return { service: null, redirectSlug: null };
}

function parseServiceContent(id: string, value: unknown) {
  const parsed = cmsServiceContentSchema.safeParse(value);
  if (!parsed.success) {
    console.error("Published service has invalid structured content", { serviceId: id });
    throw new Error("Published service content is invalid.");
  }
  return parsed.data;
}

import "server-only";
import { ContentStatus, Prisma } from "@/generated/prisma/client";
import { cmsServiceContentSchema } from "@/lib/validation/cms-service";
import { prisma } from "@/server/db";

export async function listPublishedServicesForWebsite() {
  const services = await prisma.service.findMany({
    where: { status: ContentStatus.PUBLISHED, publishedAt: { lte: new Date() } },
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    select: { id: true, slug: true, title: true, summary: true, content: true, seoTitle: true, seoDescription: true },
  });
  return services.map((service) => ({
    ...service,
    content: parseServiceContent(service.id, service.content),
  }));
}

export async function readPublishedServicesForPage() {
  try {
    return { items: await listPublishedServicesForWebsite(), unavailable: false as const };
  } catch (error) {
    if (
      !(error instanceof Prisma.PrismaClientKnownRequestError) ||
      !["P1000", "P1001", "P1002", "P1008", "P1017", "P2010"].includes(error.code)
    ) {
      throw error;
    }
    console.error("Published services could not be loaded from PostgreSQL", {
      code: error.code,
    });
    return { items: [], unavailable: true as const };
  }
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

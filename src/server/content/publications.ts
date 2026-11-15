import "server-only";
import { publicationContentSchema, type PublicationInput, type PublicationKind } from "@/lib/validation/publication";
import { prisma } from "@/server/db";

export function publicationPermission(kind: PublicationKind) {
  return kind === "projects" ? "projects:manage" : "blog:manage";
}

export async function listAdminPublications(kind: PublicationKind) {
  const select = {
    id: true, title: true, slug: true, status: true, content: true,
    coverImageId: true, updatedAt: true,
  } as const;
  const records = kind === "projects"
    ? (await prisma.project.findMany({ orderBy: { updatedAt: "desc" }, select: { ...select, summary: true } }))
      .map((item) => ({ ...item, summary: item.summary ?? "" }))
    : (await prisma.blogPost.findMany({ orderBy: { updatedAt: "desc" }, select: { ...select, excerpt: true } }))
      .map(({ excerpt, ...item }) => ({ ...item, summary: excerpt ?? "" }));
  const editable = [];
  const unsupported: { id: string; title: string; status: string }[] = [];
  for (const record of records) {
    const parsed = publicationContentSchema.safeParse(record.content);
    if (!parsed.success || (record.status !== "DRAFT" && record.status !== "PUBLISHED")) {
      unsupported.push({ id: record.id, title: record.title, status: record.status });
      continue;
    }
    editable.push({ ...record, status: record.status, content: parsed.data, updatedAt: record.updatedAt.toISOString() });
  }
  return { editable, unsupported };
}

export async function savePublication(kind: PublicationKind, id: string | null, input: PublicationInput, actorId: string, canPublish: boolean) {
  return prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(72340172838076674)`;
    const existing = id
      ? kind === "projects"
        ? await transaction.project.findUnique({ where: { id }, select: { slug: true, status: true, publishedAt: true } })
        : await transaction.blogPost.findUnique({ where: { id }, select: { slug: true, status: true, publishedAt: true } })
      : null;
    if (id && !existing) return { error: "NOT_FOUND" } as const;
    if ((input.status === "PUBLISHED" || existing?.status === "PUBLISHED") && !canPublish) {
      return { error: "PUBLISH_PERMISSION_REQUIRED" } as const;
    }
    if (existing?.publishedAt && existing.slug !== input.slug) return { error: "SLUG_LOCKED" } as const;
    const publishedAt = input.status === "PUBLISHED" ? existing?.publishedAt ?? new Date() : existing?.publishedAt ?? null;
    const data = { title: input.title, slug: input.slug, content: input.content, status: input.status, publishedAt };
    const result = kind === "projects"
      ? id
        ? await transaction.project.update({ where: { id }, data: { ...data, summary: input.summary }, select: { id: true } })
        : await transaction.project.create({ data: { ...data, summary: input.summary, createdById: actorId }, select: { id: true } })
      : id
        ? await transaction.blogPost.update({ where: { id }, data: { ...data, excerpt: input.summary }, select: { id: true } })
        : await transaction.blogPost.create({ data: { ...data, excerpt: input.summary, authorId: actorId }, select: { id: true } });
    await transaction.auditLog.create({
      data: { actorId, action: id ? "PUBLICATION_UPDATED" : "PUBLICATION_CREATED", entityType: kind === "projects" ? "Project" : "BlogPost", entityId: result.id, details: { status: input.status } },
    });
    return { id: result.id } as const;
  });
}

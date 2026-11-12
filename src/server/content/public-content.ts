import "server-only";
import { ContentStatus, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db";

function publishedAtFilter() {
  return {
    status: ContentStatus.PUBLISHED,
    publishedAt: { lte: new Date() },
  } as const;
}

function searchFilter(query: string | null, fields: string[]) {
  const search = query?.trim();
  if (!search) return {};
  const normalized = search.slice(0, 100);
  return {
    OR: fields.map((field) => ({
      [field]: { contains: normalized, mode: Prisma.QueryMode.insensitive },
    })),
  };
}

export async function listServices(page: number, pageSize: number, skip: number, query: string | null) {
  const where: Prisma.ServiceWhereInput = {
    ...publishedAtFilter(),
    ...searchFilter(query, ["title", "summary"]),
  };
  const [items, total] = await prisma.$transaction([
    prisma.service.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
      skip,
      take: pageSize,
      select: {
        slug: true,
        title: true,
        summary: true,
        content: true,
        seoTitle: true,
        seoDescription: true,
        publishedAt: true,
      },
    }),
    prisma.service.count({ where }),
  ]);
  return { items, pagination: pagination(page, pageSize, total) };
}

export function getService(slug: string) {
  return prisma.service.findFirst({
    where: { ...publishedAtFilter(), slug },
    select: {
      slug: true,
      title: true,
      summary: true,
      content: true,
      seoTitle: true,
      seoDescription: true,
      publishedAt: true,
    },
  });
}

export async function listProjects(page: number, pageSize: number, skip: number, query: string | null) {
  const where: Prisma.ProjectWhereInput = {
    ...publishedAtFilter(),
    ...searchFilter(query, ["title", "summary"]),
    AND: [
      {
        OR: [
          { industryId: null },
          { industry: { is: publishedAtFilter() } },
        ],
      },
    ],
  };
  const [items, total] = await prisma.$transaction([
    prisma.project.findMany({
      where,
      orderBy: [{ publishedAt: "desc" }, { title: "asc" }],
      skip,
      take: pageSize,
      select: {
        slug: true,
        title: true,
        summary: true,
        clientName: true,
        content: true,
        startedAt: true,
        completedAt: true,
        industry: { select: { slug: true, title: true } },
        services: {
          where: { service: publishedAtFilter() },
          select: { service: { select: { slug: true, title: true } } },
        },
      },
    }),
    prisma.project.count({ where }),
  ]);
  return { items, pagination: pagination(page, pageSize, total) };
}

export function getProject(slug: string) {
  return prisma.project.findFirst({
    where: {
      ...publishedAtFilter(),
      slug,
      AND: [
        {
          OR: [
            { industryId: null },
            { industry: { is: publishedAtFilter() } },
          ],
        },
      ],
    },
    select: {
      slug: true,
      title: true,
      summary: true,
      clientName: true,
      content: true,
      startedAt: true,
      completedAt: true,
      industry: { select: { slug: true, title: true } },
      services: {
        where: { service: publishedAtFilter() },
        select: { service: { select: { slug: true, title: true } } },
      },
      caseStudy: {
        where: publishedAtFilter(),
        select: { slug: true, title: true, summary: true },
      },
    },
  });
}

export async function listCaseStudies(page: number, pageSize: number, skip: number, query: string | null) {
  const where: Prisma.CaseStudyWhereInput = {
    ...publishedAtFilter(),
    ...searchFilter(query, ["title", "summary"]),
    AND: [
      {
        OR: [
          { projectId: null },
          { project: { is: publishedAtFilter() } },
        ],
      },
    ],
  };
  const [items, total] = await prisma.$transaction([
    prisma.caseStudy.findMany({
      where,
      orderBy: [{ publishedAt: "desc" }, { title: "asc" }],
      skip,
      take: pageSize,
      select: {
        slug: true,
        title: true,
        summary: true,
        content: true,
        outcomes: true,
        publishedAt: true,
        project: {
          select: { slug: true, title: true, clientName: true },
        },
      },
    }),
    prisma.caseStudy.count({ where }),
  ]);
  return { items, pagination: pagination(page, pageSize, total) };
}

export function getCaseStudy(slug: string) {
  return prisma.caseStudy.findFirst({
    where: {
      ...publishedAtFilter(),
      slug,
      AND: [
        {
          OR: [
            { projectId: null },
            { project: { is: publishedAtFilter() } },
          ],
        },
      ],
    },
    select: {
      slug: true,
      title: true,
      summary: true,
      content: true,
      outcomes: true,
      publishedAt: true,
      project: {
        select: { slug: true, title: true, clientName: true, content: true },
      },
    },
  });
}

export async function listIndustries(page: number, pageSize: number, skip: number, query: string | null) {
  const where: Prisma.IndustryWhereInput = {
    ...publishedAtFilter(),
    ...searchFilter(query, ["title", "summary"]),
  };
  const [items, total] = await prisma.$transaction([
    prisma.industry.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
      skip,
      take: pageSize,
      select: {
        slug: true,
        title: true,
        summary: true,
        content: true,
        seoTitle: true,
        seoDescription: true,
        publishedAt: true,
      },
    }),
    prisma.industry.count({ where }),
  ]);
  return { items, pagination: pagination(page, pageSize, total) };
}

export function getIndustry(slug: string) {
  return prisma.industry.findFirst({
    where: { ...publishedAtFilter(), slug },
    select: {
      slug: true,
      title: true,
      summary: true,
      content: true,
      seoTitle: true,
      seoDescription: true,
      publishedAt: true,
    },
  });
}

export async function listBlogPosts(
  page: number,
  pageSize: number,
  skip: number,
  query: string | null,
  categorySlug: string | null,
) {
  const where: Prisma.BlogPostWhereInput = {
    ...publishedAtFilter(),
    ...searchFilter(query, ["title", "excerpt"]),
    ...(categorySlug ? { categories: { some: { category: { slug: categorySlug } } } } : {}),
  };
  const [items, total] = await prisma.$transaction([
    prisma.blogPost.findMany({
      where,
      orderBy: [{ publishedAt: "desc" }, { title: "asc" }],
      skip,
      take: pageSize,
      select: {
        slug: true,
        title: true,
        excerpt: true,
        content: true,
        seoTitle: true,
        seoDescription: true,
        publishedAt: true,
        author: { select: { name: true } },
        categories: { select: { category: { select: { name: true, slug: true } } } },
        tags: { select: { tag: { select: { name: true, slug: true } } } },
      },
    }),
    prisma.blogPost.count({ where }),
  ]);
  return { items, pagination: pagination(page, pageSize, total) };
}

export function getBlogPost(slug: string) {
  return prisma.blogPost.findFirst({
    where: { ...publishedAtFilter(), slug },
    select: {
      slug: true,
      title: true,
      excerpt: true,
      content: true,
      seoTitle: true,
      seoDescription: true,
      publishedAt: true,
      author: { select: { name: true } },
      categories: { select: { category: { select: { name: true, slug: true } } } },
      tags: { select: { tag: { select: { name: true, slug: true } } } },
    },
  });
}

export async function listBlogCategories(page: number, pageSize: number, skip: number) {
  const where: Prisma.CategoryWhereInput = {
    posts: { some: { blogPost: publishedAtFilter() } },
  };
  const [items, total] = await prisma.$transaction([
    prisma.category.findMany({
      where,
      orderBy: { name: "asc" },
      skip,
      take: pageSize,
      select: { name: true, slug: true, description: true },
    }),
    prisma.category.count({ where }),
  ]);
  return { items, pagination: pagination(page, pageSize, total) };
}

export function getNavigation() {
  return prisma.navigationItem.findMany({
    where: { isVisible: true, parentId: null },
    orderBy: [{ location: "asc" }, { sortOrder: "asc" }],
    select: {
      label: true,
      href: true,
      location: true,
      sortOrder: true,
      isExternal: true,
      children: {
        where: { isVisible: true },
        orderBy: { sortOrder: "asc" },
        select: { label: true, href: true, isExternal: true, sortOrder: true },
      },
    },
  });
}

export function getPublicSiteSettings() {
  return prisma.siteSetting.findMany({
    where: { isPublic: true },
    orderBy: { key: "asc" },
    select: { key: true, value: true, updatedAt: true },
  });
}

export async function listTestimonials(page: number, pageSize: number, skip: number) {
  const where: Prisma.TestimonialWhereInput = publishedAtFilter();
  const [items, total] = await prisma.$transaction([
    prisma.testimonial.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { publishedAt: "desc" }],
      skip,
      take: pageSize,
      select: {
        quote: true,
        authorName: true,
        authorTitle: true,
        organization: true,
        publishedAt: true,
      },
    }),
    prisma.testimonial.count({ where }),
  ]);
  return { items, pagination: pagination(page, pageSize, total) };
}

function pagination(page: number, pageSize: number, totalItems: number) {
  return {
    page,
    pageSize,
    totalItems,
    totalPages: Math.ceil(totalItems / pageSize),
  };
}

import "server-only";
import { ContentStatus, Prisma } from "@/generated/prisma/client";
import { otherSocialLinkSchema } from "@/lib/validation/team-member";
import { prisma } from "@/server/db";

const publishedFilter = {
  status: ContentStatus.PUBLISHED,
  isActive: true,
  publishedAt: { lte: new Date() },
} as const;

const publicMemberSelect = {
  slug: true,
  name: true,
  title: true,
  department: true,
  biography: true,
  linkedinUrl: true,
  githubUrl: true,
  portfolioUrl: true,
  otherSocialLinks: true,
  profileImage: { select: { id: true, altText: true } },
} satisfies Prisma.TeamMemberSelect;

export async function listPublishedTeamMembers(take?: number, skip = 0) {
  const records = await prisma.teamMember.findMany({
    where: publishedFilter,
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    ...(take === undefined ? {} : { take }),
    ...(take === undefined ? {} : { skip }),
    select: publicMemberSelect,
  });
  return records.map(toPublicMember);
}

export function countPublishedTeamMembers() {
  return prisma.teamMember.count({ where: publishedFilter });
}

export async function getPublishedTeamMember(slug: string) {
  const member = await prisma.teamMember.findFirst({
    where: { ...publishedFilter, slug },
    select: publicMemberSelect,
  });
  return member ? toPublicMember(member) : null;
}

export async function readPublishedTeamMember(slug: string) {
  try {
    return { member: await getPublishedTeamMember(slug), unavailable: false as const };
  } catch (error) {
    if (
      !(error instanceof Prisma.PrismaClientKnownRequestError) ||
      !["P1000", "P1001", "P1002", "P1008", "P1017", "P2010", "P2021", "P2022"].includes(error.code)
    ) {
      throw error;
    }
    console.error("Team profile could not be loaded from PostgreSQL", { code: error.code });
    return { member: null, unavailable: true as const };
  }
}

export async function readPublishedTeamMembers() {
  try {
    return { items: await listPublishedTeamMembers(), unavailable: false as const };
  } catch (error) {
    if (
      !(error instanceof Prisma.PrismaClientKnownRequestError) ||
      !["P1000", "P1001", "P1002", "P1008", "P1017", "P2010", "P2021", "P2022"].includes(error.code)
    ) {
      throw error;
    }
    console.error("Published team members could not be loaded from PostgreSQL", {
      code: error.code,
    });
    return { items: [], unavailable: true as const };
  }
}

function toPublicMember(member: {
  slug: string | null;
  name: string;
  title: string;
  department: string | null;
  biography: string | null;
  linkedinUrl: string | null;
  githubUrl: string | null;
  portfolioUrl: string | null;
  otherSocialLinks: Prisma.JsonValue | null;
  profileImage: { id: string; altText: string } | null;
}) {
  const socialLinks = otherSocialLinkSchema.array().safeParse(member.otherSocialLinks);
  if (!socialLinks.success && member.otherSocialLinks !== null) {
    console.error("Published team member has invalid social links", { slug: member.slug });
  }
  return {
    slug: member.slug ?? "",
    name: member.name,
    title: member.title,
    department: member.department,
    biography: member.biography,
    profileImageUrl: member.profileImage
      ? `/api/v1/team/images/${member.profileImage.id}`
      : null,
    profileImageAlt: member.profileImage?.altText ?? "",
    linkedinUrl: member.linkedinUrl,
    githubUrl: member.githubUrl,
    portfolioUrl: member.portfolioUrl,
    otherSocialLinks: socialLinks.success ? socialLinks.data : [],
  };
}

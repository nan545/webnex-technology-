import "server-only";
import { ContentStatus, Prisma } from "@/generated/prisma/client";
import { fallbackTeamMembers } from "@/data/fallback/team";
import { otherSocialLinkSchema } from "@/lib/validation/team-member";
import { readWithDatabaseFallback } from "@/server/content/database-fallback";
import { prisma } from "@/server/db";

function publishedFilter() {
  return {
    status: ContentStatus.PUBLISHED,
    isActive: true,
    publishedAt: { lte: new Date() },
  } as const;
}

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
    where: publishedFilter(),
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    ...(take === undefined ? {} : { take }),
    ...(take === undefined ? {} : { skip }),
    select: publicMemberSelect,
  });
  return records.map(toPublicMember);
}

export function countPublishedTeamMembers() {
  return prisma.teamMember.count({ where: publishedFilter() });
}

export async function getPublishedTeamMember(slug: string) {
  const member = await prisma.teamMember.findFirst({
    where: { ...publishedFilter(), slug },
    select: publicMemberSelect,
  });
  return member ? toPublicMember(member) : null;
}

export async function readPublishedTeamMember(slug: string) {
  const result = await readWithDatabaseFallback(
    () => getPublishedTeamMember(slug),
    () => fallbackTeamMembers.find((member) => member.slug === slug) ?? null,
    "Team profile",
  );
  return { member: result.value, unavailable: result.unavailable };
}

export async function readPublishedTeamMembers() {
  const result = await readWithDatabaseFallback(
    () => listPublishedTeamMembers(),
    () => fallbackTeamMembers,
    "Published team members",
  );
  return { items: result.value, unavailable: result.unavailable };
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

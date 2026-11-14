import Link from "next/link";
import { BriefcaseBusiness, Code2, Link as LinkIcon } from "lucide-react";
import type { OtherSocialLink } from "@/lib/validation/team-member";
import { ProfilePhoto } from "@/components/team/profile-photo";

export type PublicTeamMember = {
  slug: string;
  name: string;
  title: string;
  department: string | null;
  biography: string | null;
  profileImageUrl: string | null;
  profileImageAlt: string;
  linkedinUrl: string | null;
  githubUrl: string | null;
  portfolioUrl: string | null;
  otherSocialLinks: OtherSocialLink[];
};

export function TeamProfileCard({ member }: { member: PublicTeamMember }) {
  return (
    <article className="flex h-full flex-col border border-border bg-white">
      <Link
        aria-label={`View ${member.name}'s profile`}
        className="group relative block aspect-[4/5] overflow-hidden bg-slate-100"
        href={`/team/${member.slug}`}
      >
        <ProfilePhoto
          alt={member.profileImageAlt || `Portrait of ${member.name}`}
          sizes="(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 30vw"
          src={member.profileImageUrl}
        />
      </Link>
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <p className="text-sm font-semibold text-blue-700">{member.title}</p>
        <h3 className="mt-1 text-xl font-semibold text-navy-950">
          <Link className="hover:text-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700" href={`/team/${member.slug}`}>
            {member.name}
          </Link>
        </h3>
        {member.department ? <p className="mt-1 text-sm text-muted">{member.department}</p> : null}
        {member.biography ? (
          <p className="mt-4 flex-1 text-sm leading-6 text-muted">{member.biography}</p>
        ) : (
          <p className="mt-4 flex-1 text-sm text-muted">Professional biography not provided.</p>
        )}
        <ProfileSocialLinks member={member} />
      </div>
    </article>
  );
}

export function ProfileSocialLinks({ member }: { member: PublicTeamMember }) {
  const links = [
    ...(member.linkedinUrl ? [{ href: member.linkedinUrl, label: "LinkedIn", icon: BriefcaseBusiness }] : []),
    ...(member.githubUrl ? [{ href: member.githubUrl, label: "GitHub", icon: Code2 }] : []),
    ...(member.portfolioUrl ? [{ href: member.portfolioUrl, label: "Portfolio", icon: LinkIcon }] : []),
    ...member.otherSocialLinks.map((item) => ({ href: item.url, label: item.label, icon: LinkIcon })),
  ];
  if (!links.length) return null;

  return (
    <ul aria-label={`${member.name}'s professional links`} className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
      {links.map(({ href, label, icon: Icon }) => (
        <li key={`${label}-${href}`}>
          <a
            aria-label={`${member.name} on ${label}`}
            className="inline-flex min-h-10 items-center gap-2 border border-border px-3 text-xs font-medium text-navy-900 hover:border-blue-700 hover:text-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            href={href}
            rel="noopener noreferrer"
            target="_blank"
          >
            <Icon aria-hidden="true" size={15} />
            {label}
          </a>
        </li>
      ))}
    </ul>
  );
}

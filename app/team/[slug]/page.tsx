import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ProfileSocialLinks } from "@/components/team/team-profile-card";
import { Container } from "@/components/ui/container";
import { pageMetadata } from "@/lib/seo";
import { readPublishedTeamMember } from "@/server/content/team";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const result = await readPublishedTeamMember(slug);
  if (!result.member) {
    return pageMetadata(
      "Team profile",
      "Meet the WEBNEX Technologies team.",
      `/team/${encodeURIComponent(slug)}`,
    );
  }
  const description = result.member.biography?.slice(0, 155) ||
    `${result.member.name} — ${result.member.title} at WEBNEX Technologies.`;
  return {
    ...pageMetadata(
      result.member.name,
      description,
      `/team/${result.member.slug}`,
    ),
    openGraph: {
      ...pageMetadata(result.member.name, description, `/team/${result.member.slug}`).openGraph,
      ...(result.member.profileImageUrl ? { images: [result.member.profileImageUrl] } : {}),
    },
  };
}

export default async function TeamMemberPage({ params }: Props) {
  const { slug } = await params;
  const result = await readPublishedTeamMember(slug);
  if (!result.member && !result.unavailable) notFound();

  if (result.unavailable || !result.member) {
    return (
      <section className="py-20">
        <Container>
          <p className="border border-border bg-slate-50 p-6 text-sm text-muted" role="status">
            This team profile is temporarily unavailable.
          </p>
        </Container>
      </section>
    );
  }
  const member = result.member;

  return (
    <article className="py-12 sm:py-16">
      <Container>
        <Link className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-blue-800 hover:text-navy-950" href="/team">
          <ArrowLeft aria-hidden="true" size={17} /> Back to the team
        </Link>
        <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(260px,0.75fr)_minmax(0,1.25fr)] lg:gap-16">
          <div className="relative aspect-[4/5] max-w-lg overflow-hidden bg-slate-100">
            {member.profileImageUrl ? (
              <Image
                alt={member.profileImageAlt || `Portrait of ${member.name}`}
                className="object-cover"
                fill
                priority
                sizes="(max-width: 1024px) 90vw, 35vw"
                src={member.profileImageUrl}
                unoptimized
              />
            ) : (
              <div className="grid size-full place-items-center text-sm text-muted">
                Profile photo not provided
              </div>
            )}
          </div>
          <div className="self-center">
            <p className="text-sm font-semibold text-blue-700">{member.title}</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-navy-950 sm:text-5xl">
              {member.name}
            </h1>
            {member.department ? <p className="mt-3 text-lg text-muted">{member.department}</p> : null}
            {member.biography ? (
              <div className="mt-8 max-w-3xl whitespace-pre-line text-base leading-8 text-slate-700">
                {member.biography}
              </div>
            ) : null}
            <ProfileSocialLinks member={member} />
          </div>
        </div>
      </Container>
    </article>
  );
}

export const dynamic = "force-dynamic";

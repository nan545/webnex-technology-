import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { TeamProfileCard } from "@/components/team/team-profile-card";
import { pageMetadata } from "@/lib/seo";
import { readPublishedTeamMembers } from "@/server/content/team";

export const metadata: Metadata = pageMetadata(
  "Our Team",
  "Meet the team working to engineer digital possibilities at WEBNEX Technologies.",
  "/team",
);

export default async function TeamPage() {
  const team = await readPublishedTeamMembers();
  return (
    <>
      <PageHero
        description="The people behind the technology. Meet the team working to engineer digital possibilities."
        eyebrow="Our people"
        title="Meet the Team"
      />
      <section className="py-14 sm:py-18">
        <Container>
          {team.unavailable && !team.items.length ? (
            <p className="border border-border bg-white p-5 text-sm text-muted" role="status">
              Team profiles are temporarily unavailable. Please try again later.
            </p>
          ) : team.items.length ? (
            <div className="grid items-stretch gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {team.items.map((member) => <TeamProfileCard key={member.slug} member={member} />)}
            </div>
          ) : (
            <p className="border border-border bg-white p-5 text-sm text-muted">
              Team profiles will appear here after they have been approved for publication.
            </p>
          )}
        </Container>
      </section>
    </>
  );
}

export const dynamic = "force-dynamic";

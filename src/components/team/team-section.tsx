import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { TeamProfileCard, type PublicTeamMember } from "@/components/team/team-profile-card";

const supportingText = "The people behind the technology. Meet the team working to engineer digital possibilities.";

export function TeamSection({
  members,
  unavailable = false,
  showAllLink = true,
}: {
  members: PublicTeamMember[];
  unavailable?: boolean;
  showAllLink?: boolean;
}) {
  return (
    <section aria-label="Meet the Team" className="border-y border-border bg-slate-50 py-16 sm:py-20">
      <Container>
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <SectionHeading
            description={supportingText}
            eyebrow="Our people"
            title="Meet the Team"
          />
          {showAllLink ? (
            <Link className="inline-flex min-h-11 items-center gap-2 font-semibold text-blue-800 hover:text-navy-950" href="/team">
              Meet the full team <ArrowRight aria-hidden="true" size={17} />
            </Link>
          ) : null}
        </div>
        {unavailable && !members.length ? (
          <p className="mt-8 border border-border bg-white p-5 text-sm text-muted" role="status">
            Team profiles are temporarily unavailable. Please try again later.
          </p>
        ) : members.length ? (
          <div className="mt-10 grid items-stretch gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {members.slice(0, 3).map((member) => <TeamProfileCard key={member.slug} member={member} />)}
          </div>
        ) : (
          <p className="mt-8 border border-border bg-white p-5 text-sm text-muted">
            Team profiles will appear here after they have been approved for publication.
          </p>
        )}
      </Container>
    </section>
  );
}

import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = {
  ...pageMetadata(
    "Privacy",
    "Privacy notice status for the WEBNEX Technologies website.",
    "/privacy",
  ),
  robots: { index: false, follow: true },
};

export default function PrivacyPage() {
  return (
    <>
      <PageHero
        description="Privacy information should explain what data is collected, why it is used, how long it is retained, and how people can exercise their rights."
        eyebrow="Privacy"
        title="Privacy notice pending review."
      />
      <section className="py-16 sm:py-20">
        <Container className="max-w-3xl">
          <div className="border-l-2 border-blue-700 pl-6">
            <h2 className="text-xl font-semibold text-navy-950">
              This is not a final privacy policy.
            </h2>
            <p className="mt-4 leading-7 text-muted">
              The final notice must be prepared and approved against WEBNEX
              Technologies’ actual data practices and applicable legal
              requirements before production use.
            </p>
            <p className="mt-4 leading-7 text-muted">
              The Phase 2 enquiry form does not currently store submissions.
              It is prepared to call a backend endpoint that has not yet been
              implemented. Do not enter sensitive personal or financial
              information.
            </p>
          </div>
        </Container>
      </section>
    </>
  );
}

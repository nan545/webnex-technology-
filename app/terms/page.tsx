import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { PageHero } from "@/components/ui/page-hero";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = {
  ...pageMetadata(
    "Terms",
    "Terms of use status for the WEBNEX Technologies website.",
    "/terms",
  ),
  robots: { index: false, follow: true },
};

export default function TermsPage() {
  return (
    <>
      <PageHero
        description="Website terms should reflect WEBNEX Technologies’ actual services, jurisdiction, and legal requirements."
        eyebrow="Terms"
        title="Website terms pending review."
      />
      <section className="py-16 sm:py-20">
        <Container className="max-w-3xl">
          <div className="border-l-2 border-blue-700 pl-6">
            <h2 className="text-xl font-semibold text-navy-950">
              This is not a legal agreement.
            </h2>
            <p className="mt-4 leading-7 text-muted">
              Final terms must be reviewed and approved by WEBNEX Technologies
              before launch. This page does not create contractual terms or
              describe products and services beyond the information shown on
              this website.
            </p>
          </div>
        </Container>
      </section>
    </>
  );
}

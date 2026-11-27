import { ArrowRight } from "lucide-react";
import { ButtonLink } from "@/components/ui/button-link";
import { Container } from "@/components/ui/container";

export function CtaSection() {
  return (
    <section className="bg-navy-950 py-16 text-white sm:py-20">
      <Container className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
        <div className="max-w-2xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-blue-100">
            Let’s talk
          </p>
          <h2 className="text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
            Planning a digital initiative?
          </h2>
          <p className="mt-4 max-w-xl leading-7 text-slate-300">
            Let’s discuss how technology can help your business achieve more.
          </p>
        </div>
        <ButtonLink
          className="shrink-0"
          href="/contact"
          variant="secondary"
        >
          Request a Consultation <ArrowRight aria-hidden="true" size={16} />
        </ButtonLink>
      </Container>
    </section>
  );
}

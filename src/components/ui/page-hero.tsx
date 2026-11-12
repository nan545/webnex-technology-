import { Container } from "@/components/ui/container";

export function PageHero({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <section className="border-b border-border bg-slate-50 py-16 sm:py-20">
      <Container>
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
          {eyebrow}
        </p>
        <h1 className="max-w-4xl text-4xl font-semibold leading-tight tracking-[-0.04em] text-navy-950 sm:text-5xl lg:text-6xl">
          {title}
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-muted">
          {description}
        </p>
      </Container>
    </section>
  );
}

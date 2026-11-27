import { Container } from "@/components/ui/container";

import Image from "next/image";

export function PageHero({
  eyebrow,
  title,
  description,
  image,
}: {
  eyebrow: string;
  title: string;
  description: string;
  image?: { src: string; alt: string };
}) {
  return (
    <section className="border-b border-border bg-slate-50 py-16 sm:py-20">
      <Container className={image ? "grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]" : undefined}>
        <div>
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
            {eyebrow}
          </p>
          <h1 className="max-w-4xl text-4xl font-semibold leading-tight tracking-[-0.04em] text-navy-950 sm:text-5xl lg:text-6xl">
            {title}
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted">
            {description}
          </p>
        </div>
        {image ? (
          <div className="relative aspect-[16/10] overflow-hidden bg-white">
            <Image
              alt={image.alt}
              className="object-cover"
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 560px"
              src={image.src}
            />
          </div>
        ) : null}
      </Container>
    </section>
  );
}

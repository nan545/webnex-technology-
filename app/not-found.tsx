import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Container } from "@/components/ui/container";

export default function NotFound() {
  return (
    <section className="py-24 sm:py-32">
      <Container className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
          404 · Page not found
        </p>
        <h1 className="mt-5 text-4xl font-semibold tracking-[-0.04em] text-navy-950 sm:text-5xl">
          This page isn’t available.
        </h1>
        <p className="mt-5 max-w-xl leading-7 text-muted">
          The link may be incorrect, or the page may have moved. Use the
          navigation to find what you need.
        </p>
        <Link
          className="mt-8 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-blue-700 hover:text-navy-950"
          href="/"
        >
          <ArrowLeft aria-hidden="true" size={16} /> Return home
        </Link>
      </Container>
    </section>
  );
}

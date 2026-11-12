import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Industry } from "@/data/industries";

export function IndustryCard({ industry }: { industry: Industry }) {
  const Icon = industry.icon;

  return (
    <article className="border border-border bg-white p-6">
      <Icon aria-hidden="true" className="text-blue-700" size={25} strokeWidth={1.7} />
      <h3 className="mt-5 text-lg font-semibold text-navy-950">
        {industry.title}
      </h3>
      <p className="mt-3 text-sm leading-6 text-muted">
        {industry.introduction}
      </p>
      <Link
        className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-blue-700 hover:text-navy-950"
        href={`/industries/${industry.slug}`}
      >
        Explore this industry <ArrowRight aria-hidden="true" size={15} />
      </Link>
    </article>
  );
}

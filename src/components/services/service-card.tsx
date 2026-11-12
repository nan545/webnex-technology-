import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { Service } from "@/data/services";

export function ServiceCard({ service }: { service: Service }) {
  const Icon = service.icon;

  return (
    <article className="group relative border border-border bg-white p-6 transition-colors hover:border-blue-700 sm:p-7">
      <Icon aria-hidden="true" className="text-blue-700" size={25} strokeWidth={1.7} />
      <h3 className="mt-6 text-lg font-semibold text-navy-950">
        <Link
          className="after:absolute after:inset-0"
          href={`/services/${service.slug}`}
        >
          {service.title}
        </Link>
      </h3>
      <p className="mt-3 text-sm leading-6 text-muted">
        {service.shortDescription}
      </p>
      <span className="relative mt-6 inline-flex items-center gap-1 text-sm font-semibold text-blue-700 group-hover:text-navy-950">
        Learn more <ArrowUpRight aria-hidden="true" size={15} />
      </span>
    </article>
  );
}

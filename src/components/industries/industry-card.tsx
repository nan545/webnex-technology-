import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Industry } from "@/data/industries";
import Image from "next/image";

const industryImages: Record<string, { src: string; alt: string }> = {
  education: { src: "/images/education.webp", alt: "Students learning in an education environment" },
  hospitality: { src: "/images/hospitality.webp", alt: "Modern hospitality venue" },
  "retail-and-ecommerce": { src: "/images/retail.webp", alt: "Modern retail and ecommerce environment" },
  restaurants: { src: "/images/restaurant.webp", alt: "Contemporary restaurant operations" },
  "professional-services": { src: "/images/professional.webp", alt: "Professional services team in a meeting" },
  "smes-startups": { src: "/images/startup.webp", alt: "Startup team collaborating" },
};

export function IndustryCard({ industry }: { industry: Industry }) {
  const Icon = industry.icon;
  const image = industryImages[industry.slug];

  return (
    <article className="overflow-hidden border border-border bg-white">
      {image ? (
        <div className="relative aspect-[16/9]">
          <Image alt={image.alt} className="object-cover" fill sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw" src={image.src} />
        </div>
      ) : null}
      <div className="p-6">
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
      </div>
    </article>
  );
}

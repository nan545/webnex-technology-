import Image from "next/image";
import { Compass, PenTool, Wrench } from "lucide-react";
import { BrandLogo } from "@/components/layout/brand-logo";

export function HeroIllustration() {
  return (
    <div
      className="relative mx-auto hidden aspect-[5/4] w-full max-w-[560px] lg:block"
    >
      <Image
        alt="Technology professionals collaborating around a digital workspace"
        className="object-cover"
        fill
        priority
        sizes="(max-width: 1024px) 0px, 560px"
        src="/images/hero-team.webp"
      />
      <div className="absolute inset-0 bg-navy-950/5" />
      <div className="absolute left-5 top-5 z-10 grid size-28 place-items-center border border-white/70 bg-white/95 shadow-[0_20px_70px_rgba(11,31,58,0.16)]">
        <BrandLogo className="w-28" />
      </div>

      <Pillar
        className="right-0 top-10"
        description="Find the right direction"
        icon={Compass}
        title="Strategy"
      />
      <Pillar
        className="bottom-16 left-0"
        description="Build for what matters"
        icon={Wrench}
        title="Engineering"
      />
      <Pillar
        className="bottom-5 right-0"
        description="Design around people"
        icon={PenTool}
        title="Experience"
      />
    </div>
  );
}

function Pillar({
  className,
  description,
  icon: Icon,
  title,
}: {
  className: string;
  description: string;
  icon: typeof Compass;
  title: string;
}) {
  return (
    <div
      className={`absolute z-10 flex min-w-48 items-center gap-3 border border-border bg-white px-4 py-3 shadow-sm ${className}`}
    >
      <span className="grid size-9 shrink-0 place-items-center bg-blue-50 text-blue-700">
        <Icon aria-hidden="true" size={18} strokeWidth={1.8} />
      </span>
      <span>
        <span className="block text-xs font-semibold tracking-wide text-navy-950">
          {title}
        </span>
        <span className="mt-1 block text-[10px] leading-4 text-muted">
          {description}
        </span>
      </span>
    </div>
  );
}

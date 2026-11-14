import { Compass, PenTool, Wrench } from "lucide-react";
import { BrandLogo } from "@/components/layout/brand-logo";

export function HeroIllustration() {
  return (
    <div
      aria-hidden="true"
      className="relative mx-auto hidden aspect-square w-full max-w-[500px] items-center justify-center lg:flex"
    >
      <div className="absolute inset-3 bg-slate-50" />
      <div className="absolute inset-8 border border-blue-100" />
      <div className="absolute inset-16 border border-border" />
      <div className="absolute inset-28 rounded-full border border-dashed border-blue-100" />
      <svg
        aria-hidden="true"
        className="absolute inset-0 size-full"
        fill="none"
        viewBox="0 0 500 500"
      >
        <path
          d="M250 166V116h119v-18M166 250H99v91m235-91h67v91"
          stroke="#A8C8E8"
          strokeDasharray="4 6"
          strokeWidth="1.5"
        />
        <circle cx="369" cy="98" r="4" fill="#2878B9" />
        <circle cx="99" cy="341" r="4" fill="#2878B9" />
        <circle cx="401" cy="341" r="4" fill="#2878B9" />
      </svg>

      <div className="relative z-10 grid size-36 place-items-center border border-blue-700 bg-white shadow-[0_20px_70px_rgba(11,31,58,0.12)]">
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

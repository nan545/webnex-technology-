"use client";

import Image from "next/image";
import { useState } from "react";

export function ProfilePhoto({
  src,
  alt,
  sizes,
  priority = false,
}: {
  src: string | null;
  alt: string;
  sizes: string;
  priority?: boolean;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (!src || src === failedSrc) {
    return (
      <div className="grid size-full place-items-center text-sm text-muted">
        Profile photo not available
      </div>
    );
  }

  return (
    <Image
      alt={alt}
      className="object-cover transition-transform duration-300 group-hover:scale-[1.025]"
      fill
      onError={() => setFailedSrc(src)}
      priority={priority}
      sizes={sizes}
      src={src}
      unoptimized
    />
  );
}

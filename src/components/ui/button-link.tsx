import Link from "next/link";
import type { ReactNode } from "react";

type ButtonLinkProps = {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "text";
  className?: string;
};

const variants = {
  primary:
    "bg-blue-700 text-white hover:bg-navy-800 focus-visible:outline-white",
  secondary:
    "border border-border bg-white text-navy-950 hover:border-blue-700 hover:text-blue-700",
  text: "px-0 text-blue-700 hover:text-navy-950",
};

export function ButtonLink({
  href,
  children,
  variant = "primary",
  className = "",
}: ButtonLinkProps) {
  return (
    <Link
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-sm px-5 py-3 text-sm font-semibold transition-colors ${variants[variant]} ${className}`}
      href={href}
    >
      {children}
    </Link>
  );
}

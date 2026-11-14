export function BrandLogo({
  className = "w-40",
  inverse = false,
}: {
  className?: string;
  inverse?: boolean;
}) {
  return (
    <span aria-hidden="true" className={`inline-flex shrink-0 flex-col ${className} ${inverse ? "text-white" : "text-navy-950"}`}>
      <svg className="block w-full" fill="currentColor" viewBox="0 0 239 33">
        <path d="M0 3h7l6 19 6-15 6 15 7-19h7L27 30h-4l-4-11-4 11h-4L0 3Z" />
        <path d="M48 3h29l-6 6H55v4h19l-5 6H55v5h22l-6 6H48V3Z" />
        <path d="M86 3h21l9 7v3l-4 3 5 4v4l-7 6H86V3Zm7 6v4h12l4-2-3-2H93Zm0 10v5h13l4-2-4-3H93Z" fillRule="evenodd" />
        <path d="M126 30V3h6l17 16V3h7v27h-6l-17-17v17h-7Z" />
        <path d="M166 3h29l-6 6h-16v4h19l-5 6h-14v5h22l-6 6h-23V3Z" />
        <path className={inverse ? "text-blue-200" : "text-blue-700"} d="M204 3h9l8 8 8-8h9l-12.5 13L239 30h-9l-9-9-9 9h-9l13.5-14L204 3Z" />
      </svg>
      <span className={`mt-1 text-[9px] font-semibold leading-none tracking-[0.3em] ${inverse ? "text-blue-200" : "text-muted"}`}>
        TECHNOLOGIES
      </span>
    </span>
  );
}

export function BrandLogo({
  className = "w-40",
  inverse = false,
}: {
  className?: string;
  inverse?: boolean;
}) {
  return (
    <span aria-hidden="true" className={`inline-flex shrink-0 items-center gap-2 ${className} ${inverse ? "text-white" : "text-navy-950"}`}>
      <svg className="h-10 w-7 shrink-0" fill="currentColor" viewBox="0 0 251 343">
        <path d="M1 85 Q1 80 5 84 L43 121 Q49 127 54 122 L175 2 Q180 -2 180 5 V84 Q180 99 169 110 L5 273 Q1 277 1 271 Z" />
        <path d="M84 232 L246 70 Q251 65 251 72 V257 Q251 264 246 259 L204 220 Q199 215 193 221 L75 341 Q70 346 70 339 V262 Q70 246 84 232 Z" />
      </svg>
      <span className="min-w-0 flex-1">
        <svg className="block w-full" fill="currentColor" viewBox="0 0 239 33">
          <path d="M0 3h7l6 19 6-15 6 15 7-19h7L27 30h-4l-4-11-4 11h-4L0 3Z" />
          <path d="M48 3h29l-6 6H55v4h19l-5 6H55v5h22l-6 6H48V3Z" />
          <path d="M86 3h21l9 7v3l-4 3 5 4v4l-7 6H86V3Zm7 6v4h12l4-2-3-2H93Zm0 10v5h13l4-2-4-3H93Z" fillRule="evenodd" />
          <path d="M126 30V3h6l17 16V3h7v27h-6l-17-17v17h-7Z" />
          <path d="M166 3h29l-6 6h-16v4h19l-5 6h-14v5h22l-6 6h-23V3Z" />
          <path className={inverse ? "text-blue-200" : "text-blue-700"} d="M204 3h9l8 8 8-8h9l-12.5 13L239 30h-9l-9-9-9 9h-9l13.5-14L204 3Z" />
        </svg>
        <span className={`mt-1 block text-[8px] font-semibold leading-none tracking-[0.2em] ${inverse ? "text-blue-200" : "text-muted"}`}>
          TECHNOLOGIES
        </span>
      </span>
    </span>
  );
}

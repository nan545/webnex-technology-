import { FileSearch2 } from "lucide-react";

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="border border-dashed border-border bg-white px-6 py-14 text-center">
      <FileSearch2 aria-hidden="true" className="mx-auto text-blue-700" size={28} />
      <h2 className="mt-4 text-lg font-semibold text-navy-950">{title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted">
        {description}
      </p>
    </div>
  );
}

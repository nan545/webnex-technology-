import { notFound } from "next/navigation";
import { PublicationManagement } from "@/components/admin/publication-management";
import { publicationKindSchema } from "@/lib/validation/publication";
import { requireAdminPage } from "@/server/auth/admin-page";
import { listAdminPublications, publicationPermission } from "@/server/content/publications";

export default async function PublicationsPage({ params }: { params: Promise<{ kind: string }> }) {
  const parsed = publicationKindSchema.safeParse((await params).kind);
  if (!parsed.success) notFound();
  const kind = parsed.data;
  const admin = await requireAdminPage(publicationPermission(kind));
  const { editable, unsupported } = await listAdminPublications(kind);
  return <div className="space-y-6">
    <header>
      <p className="text-sm font-semibold text-blue-700">Content management</p>
      <h1 className="mt-1 text-2xl font-semibold">{kind === "projects" ? "Projects" : "Insights"}</h1>
      <p className="mt-2 text-sm text-muted">Create drafts and publish approved content to the website.</p>
    </header>
    {unsupported.length ? <section className="border border-amber-300 bg-amber-50 p-5" role="alert">
      <h2 className="font-semibold">Existing content needs review</h2>
      <p className="mt-2 text-sm">These records use an unsupported format or status and cannot be edited here. Contact an administrator to review them; their data has not been changed.</p>
      <ul className="mt-2 list-inside list-disc text-sm">
        {unsupported.map((record) => <li key={record.id}>{record.title} · {record.status} · {record.id}</li>)}
      </ul>
    </section> : null}
    <PublicationManagement kind={kind} records={editable} canPublish={admin.permissions.has("content:publish")} />
  </div>;
}

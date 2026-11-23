import { MediaLibrary } from "@/components/admin/media-library";
import { requireAdminPage } from "@/server/auth/admin-page";

export const metadata = { title: "Media library | WEBNEX Admin" };
export const dynamic = "force-dynamic";

export default async function MediaLibraryPage() {
  await requireAdminPage("media:manage");

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold text-blue-700">Content management</p>
        <h1 className="mt-1 text-2xl font-semibold text-navy-950">Media library</h1>
        <p className="mt-2 text-sm text-muted">
          Upload and manage reusable private images. Uploaded files are not publicly linked until referenced by content.
        </p>
      </header>
      <MediaLibrary />
    </div>
  );
}

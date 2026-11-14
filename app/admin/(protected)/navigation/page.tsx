import { NavigationEditor } from "@/components/admin/navigation-editor";
import { requireAdminPage } from "@/server/auth/admin-page";
import { getNavigationConfiguration } from "@/server/content/site-configuration";

export const metadata = { title: "Navigation | WEBNEX Admin" };
export const dynamic = "force-dynamic";

export default async function AdminNavigationPage() {
  await requireAdminPage("content:publish");
  const navigation = await getNavigationConfiguration();

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold text-blue-700">Content management</p>
        <h1 className="mt-1 text-2xl font-semibold text-navy-950">Navigation</h1>
      </header>
      <NavigationEditor initial={navigation} />
    </div>
  );
}

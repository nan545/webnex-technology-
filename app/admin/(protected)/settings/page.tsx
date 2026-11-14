import { ContactPhoneEditor } from "@/components/admin/contact-phone-editor";
import { requireAdminPage } from "@/server/auth/admin-page";
import { getContactPhone } from "@/server/content/site-configuration";

export const metadata = { title: "Settings | WEBNEX Admin" };
export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  await requireAdminPage("settings:manage");
  const phone = await getContactPhone();

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold text-blue-700">Site management</p>
        <h1 className="mt-1 text-2xl font-semibold text-navy-950">Settings</h1>
      </header>
      <ContactPhoneEditor initial={phone} />
    </div>
  );
}

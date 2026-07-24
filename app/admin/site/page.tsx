import { AdminPageShell } from "@/components/admin/AdminPageShell";
import { AdminSiteManager } from "@/components/admin/AdminSiteManager";
import { requireSuperAdminPage } from "@/lib/modules/auth/super-admin";
import {
  getSiteConfig,
  listCustomPages,
} from "@/lib/modules/site/site-store";

export const dynamic = "force-dynamic";

export default async function AdminSitePage() {
  await requireSuperAdminPage();
  const [config, pages] = await Promise.all([
    getSiteConfig(),
    listCustomPages(),
  ]);

  return (
    <AdminPageShell currentPath="/admin/site">
      <p className="text-sm font-semibold text-[#8B6914]">السوبر أدمن</p>
      <h1 className="mt-2 text-3xl font-bold text-[#0E3435]">لوحة الموقع</h1>
      <p className="mt-3 max-w-3xl leading-8 text-[rgba(14,52,53,0.72)]">
        تحكّم بالهوية والألوان ونصوص الرئيسية وتفعيل الصفحات العامة وإنشاء صفحات
        بسيطة — دون كسر الدخول أو لوحة التحكم أو إدارة التشغيل.
      </p>
      <AdminSiteManager initialConfig={config} initialPages={pages} />
    </AdminPageShell>
  );
}

import { AdminPageShell } from "@/components/admin/AdminPageShell";
import { requireSuperAdminPage } from "@/lib/modules/auth/super-admin";
import { getSettingsStatus } from "@/lib/modules/settings/settings-service";
import { AdminSettingsForm } from "@/components/AdminSettingsForm";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  await requireSuperAdminPage();
  const settings = await getSettingsStatus().catch(() => []);

  return (
    <AdminPageShell currentPath="/admin/settings">
      <header className="mb-6">
        <p className="text-sm font-semibold text-[#8B6914]">السوبر أدمن</p>
        <h1 className="mt-2 text-2xl font-bold text-[var(--navy)]">إعدادات المنصّة</h1>
        <p className="mt-2 text-sm leading-7 text-[#0E3435]/70">
          أدِر مفاتيح التشغيل من هنا بلا Vercel: الذكاء، البحث، Google/Microsoft، Moyasar، Resend،
          Twilio، والحصّة المجانية. تُحمَّل عند إقلاع الخادم وتُطبَّق فور الحفظ على هذه النسخة.
          Redirect URI لـ Google:
          <span dir="ltr" className="mx-1 font-mono text-xs">
            https://hakeem-platform.vercel.app/api/auth/callback/google
          </span>
        </p>
      </header>
      <AdminSettingsForm initial={settings} />
      <p className="mt-6 rounded-md border border-[#C69763]/25 bg-[var(--parchment)] p-4 text-xs leading-6 text-[#0E3435]/70">
        ملاحظة: مفاتيح الإقلاع الأساسية (مثل AUTH_SECRET وREQUIRE_AUTH) تبقى في Vercel — لأنها تلزم قبل
        قراءة قاعدة البيانات. كل ما عداها يُدار من هنا.
      </p>
    </AdminPageShell>
  );
}

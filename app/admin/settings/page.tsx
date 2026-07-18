import { requirePagePermission } from "@/lib/modules/auth/session";
import { getSettingsStatus } from "@/lib/modules/settings/settings-service";
import { AdminSettingsForm } from "@/components/AdminSettingsForm";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  await requirePagePermission("USERS_MANAGE");
  const settings = await getSettingsStatus().catch(() => []);

  return (
    <main className="mx-auto max-w-3xl px-5 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--navy)]">إعدادات المنصّة</h1>
        <p className="mt-2 text-sm leading-7 text-[#0E3435]/70">
          أدِر مفاتيح التشغيل (الذكاء، البحث، دخول Google) من هنا — بدون الذهاب إلى Vercel. القيم
          المحفوظة هنا تُحمَّل عند إقلاع الخادم. لتفعيل زر «الدخول عبر Google»: الصق Client ID و
          Client Secret في قسم «دخول Google» واحفظ. Redirect URI في Google Cloud:
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
    </main>
  );
}

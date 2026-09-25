import Link from "next/link";
import { AdminPageShell } from "@/components/admin/AdminPageShell";
import { FeatureTogglesManager } from "@/components/admin/FeatureTogglesManager";
import { requireSuperAdminPage } from "@/lib/modules/auth/super-admin";
import { listFeatureToggles } from "@/lib/modules/admin/feature-toggles";
import { getAiStatus } from "@/lib/modules/ai/ai-config";
import { isClerkConfigured } from "@/lib/modules/auth/clerk-config";
import { isGoogleOAuthConfigured } from "@/lib/modules/auth/google-oauth";
import { isMicrosoftOAuthConfigured } from "@/lib/modules/auth/microsoft-oauth";
import { getAuthProductionStatus } from "@/lib/modules/auth/production-auth";
import { sharePointConfigured, storageBackend } from "@/lib/modules/attachments/blob-storage";

export const dynamic = "force-dynamic";

export default async function AdminServicesPage() {
  await requireSuperAdminPage();
  const [toggles, ai] = await Promise.all([
    listFeatureToggles(),
    getAiStatus().catch(() => null),
  ]);
  const auth = getAuthProductionStatus();

  const runtime = [
    { label: "Clerk", ok: isClerkConfigured() },
    { label: "Google OAuth", ok: isGoogleOAuthConfigured() },
    { label: "Microsoft OAuth", ok: isMicrosoftOAuthConfigured() },
    {
      label: "الذكاء الاصطناعي",
      ok: Boolean(ai && ai.provider !== "offline" && ai.configured),
    },
    { label: "SharePoint", ok: sharePointConfigured() },
    { label: "تخزين المرفقات", ok: storageBackend() !== "metadata-only" },
  ];

  const googleModeLabel =
    auth.googleMode === "native"
      ? "أصلي (مباشر إلى Google)"
      : auth.googleMode === "clerk_fallback"
        ? "احتياطي عبر Clerk"
        : "غير متاح";

  const clerkKindLabel =
    auth.clerkInstance === "live"
      ? "Production (pk_live_)"
      : auth.clerkInstance === "test"
        ? "Development (pk_test_)"
        : "غير مضبوط";

  return (
    <AdminPageShell currentPath="/admin/services">
      <p className="text-sm font-semibold text-[#8B6914]">السوبر أدمن</p>
      <h1 className="mt-2 text-3xl font-bold text-[#0E3435]">إدارة خدمات حكيم</h1>
      <p className="mt-3 max-w-3xl leading-8 text-[rgba(14,52,53,0.72)]">
        إظهار أو إخفاء واجهات الخدمات للمستخدمين دون تعطيل المحركات الخلفية. التغييرات تُسجَّل في
        التدقيق وتتطلب تأكيدًا.
      </p>

      <section className="mt-6 rounded-[0.75rem] border border-[rgba(14,52,53,0.1)] bg-[#FFFcf7] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[#0E3435]">جاهزية دخول الإنتاج</h2>
            <p className="mt-1 text-sm leading-7 text-[rgba(14,52,53,0.65)]">
              المسار المفضّل للعامة: Google الأصلي. Clerk على النطاق الحي يتطلب مفاتيح Production.
            </p>
          </div>
          <span
            className={`rounded-md px-3 py-1.5 text-sm font-bold ${
              auth.ready ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"
            }`}
          >
            {auth.ready ? "جاهز" : "يحتاج ضبطًا"}
          </span>
        </div>

        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          <li className="rounded-md border border-[rgba(14,52,53,0.08)] bg-white px-4 py-3 text-sm">
            <p className="text-[rgba(14,52,53,0.55)]">مسار Google</p>
            <p className="mt-1 font-semibold text-[#0E3435]">{googleModeLabel}</p>
          </li>
          <li className="rounded-md border border-[rgba(14,52,53,0.08)] bg-white px-4 py-3 text-sm">
            <p className="text-[rgba(14,52,53,0.55)]">نسخة Clerk</p>
            <p className="mt-1 font-semibold text-[#0E3435]">{clerkKindLabel}</p>
          </li>
          <li className="rounded-md border border-[rgba(14,52,53,0.08)] bg-white px-4 py-3 text-sm">
            <p className="text-[rgba(14,52,53,0.55)]">مضيف Clerk</p>
            <p className="mt-1 break-all font-semibold text-[#0E3435]" dir="ltr">
              {auth.clerkFrontendHost || "—"}
            </p>
          </li>
          <li className="rounded-md border border-[rgba(14,52,53,0.08)] bg-white px-4 py-3 text-sm">
            <p className="text-[rgba(14,52,53,0.55)]">بيئة التشغيل</p>
            <p className="mt-1 font-semibold text-[#0E3435]">
              {auth.productionRuntime ? "إنتاج" : "تطوير / معاينة"}
            </p>
          </li>
        </ul>

        <p className="mt-4 rounded-md border border-[rgba(14,52,53,0.08)] bg-white px-4 py-3 text-sm leading-7 text-[rgba(14,52,53,0.78)]">
          {auth.recommendation}
        </p>
        <p className="mt-3 text-sm">
          <Link href="/admin/settings" className="font-semibold text-[#8B6914] hover:text-[#0E3435]">
            ضبط مفاتيح Google وClerk من إعدادات التشغيل ←
          </Link>
        </p>
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-bold text-[#0E3435]">حالة التشغيل الفعلية</h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {runtime.map((r) => (
            <li
              key={r.label}
              className="flex items-center justify-between rounded-md border border-[rgba(14,52,53,0.1)] bg-[#FFFcf7] px-4 py-3 text-sm"
            >
              <span>{r.label}</span>
              <span
                className={r.ok ? "font-semibold text-emerald-700" : "font-semibold text-amber-700"}
              >
                {r.ok ? "جاهز" : "يتطلب ضبطًا"}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-bold text-[#0E3435]">رايات الظهور في الواجهة</h2>
        <p className="mt-2 text-sm text-[rgba(14,52,53,0.6)]">
          تُخزَّن في جدول feature_toggles القائم.
        </p>
        <div className="mt-4">
          <FeatureTogglesManager initial={toggles} />
        </div>
      </section>
    </AdminPageShell>
  );
}

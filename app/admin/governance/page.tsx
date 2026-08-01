import { AdminPageShell } from "@/components/admin/AdminPageShell";
import { requirePagePermission } from "@/lib/modules/auth/session";
import { buildHealthIndex, type HealthLevel } from "@/lib/modules/observability/health-index";
import { listModels } from "@/lib/modules/ai/model-registry";
import { listPrompts } from "@/lib/modules/ai/prompts/registry";
import { loadPackages } from "@/lib/modules/packages/manifest-loader";
import { DATA_CLASS_LABELS_AR } from "@/lib/modules/security/data-classification";
import { complianceRuleStats } from "@/lib/modules/compliance/engine";
import { COMPATIBILITY_MATRIX, DEPRECATIONS } from "@/lib/modules/governance/compatibility";

export const dynamic = "force-dynamic";

const LEVEL_STYLE: Record<HealthLevel, string> = {
  healthy: "bg-[#0E3435] text-[#FFFcf7]",
  degraded: "bg-[#B45309] text-white",
  unknown: "bg-[rgba(14,52,53,0.12)] text-[#0E3435]",
};

/**
 * لوحة الحوكمة المعمارية (المخطط السيادي) — تربط المؤشّرات والسجلّات بالموقع فعليًّا.
 * مصدرها الوحيد الوثائق في docs/architecture. الصلاحية: GOVERNANCE_AUDIT_VIEW.
 */
export default async function GovernancePage() {
  await requirePagePermission("GOVERNANCE_AUDIT_VIEW");

  const health = await buildHealthIndex(new Date().toISOString()).catch(() => null);
  const models = listModels();
  const prompts = listPrompts();
  const packages = loadPackages();
  const compliance = complianceRuleStats();

  return (
    <AdminPageShell currentPath="/admin/governance">
      <main className="mx-auto w-full max-w-5xl px-4 py-6" dir="rtl">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-[#0E3435]">الحوكمة المعمارية</h1>
          <p className="mt-1 text-sm text-[rgba(14,52,53,0.7)]">
            مواءمة المنصّة مع المخطط السيادي — مؤشّرات وسجلّات حيّة. المرجع:{" "}
            <code className="rounded bg-[#F7F2EA] px-1">docs/architecture/</code>
          </p>
        </header>

        {/* مؤشّر الصحّة متعدّد الأبعاد (§13/§23) */}
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-[#0E3435]">مؤشّر الصحّة (§13)</h2>
          {health ? (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                {health.dimensions.map((d) => (
                  <div
                    key={d.key}
                    className="rounded-xl border border-[rgba(14,52,53,0.1)] bg-white p-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-[#0E3435]">{d.labelAr}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs ${LEVEL_STYLE[d.level]}`}>
                        {d.score}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-[rgba(14,52,53,0.6)]">{d.detail}</p>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-[rgba(14,52,53,0.55)]">{health.note}</p>
            </>
          ) : (
            <p className="text-sm text-[rgba(14,52,53,0.6)]">تعذّر حساب المؤشّر حاليًّا.</p>
          )}
        </section>

        {/* سجلّ النماذج (§17) */}
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-[#0E3435]">سجلّ النماذج (§17)</h2>
          <div className="overflow-x-auto rounded-xl border border-[rgba(14,52,53,0.1)]">
            <table className="w-full text-right text-sm">
              <thead className="bg-[#F7F2EA] text-[rgba(14,52,53,0.7)]">
                <tr>
                  <th className="p-2 font-semibold">المزوّد</th>
                  <th className="p-2 font-semibold">النموذج</th>
                  <th className="p-2 font-semibold">السياق</th>
                  <th className="p-2 font-semibold">الخصوصية</th>
                  <th className="p-2 font-semibold">المهام المعتمدة</th>
                </tr>
              </thead>
              <tbody>
                {models.map((m) => (
                  <tr key={`${m.provider}:${m.model}`} className="border-t border-[rgba(14,52,53,0.06)]">
                    <td className="p-2">{m.provider}</td>
                    <td className="p-2 font-mono text-xs">{m.model}</td>
                    <td className="p-2">{m.contextWindow.toLocaleString("en-US")}</td>
                    <td className="p-2">{m.privacy}</td>
                    <td className="p-2 text-xs">{m.approvedTasks.join("، ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* سجلّ البرومبتات (§17) */}
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-[#0E3435]">
            سجلّ البرومبتات (§17) — {prompts.length}
          </h2>
          <div className="flex flex-wrap gap-2">
            {prompts.map((p) => (
              <span
                key={p.id}
                title={`${p.builder} · ${p.owner}`}
                className="rounded-md bg-white px-2 py-1 font-mono text-xs text-[#0E3435] ring-1 ring-[rgba(14,52,53,0.1)]"
              >
                {p.id}@{p.version}
              </span>
            ))}
          </div>
        </section>

        {/* حزم المجال/المؤسسة (§16) */}
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-[#0E3435]">حزم المجال/المؤسسة (§16)</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {packages.map((pkg) => (
              <div
                key={pkg.path}
                className="rounded-xl border border-[rgba(14,52,53,0.1)] bg-white p-3"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#0E3435]">
                    {pkg.manifest?.name ?? pkg.path}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      pkg.ok ? "bg-[#0E3435] text-[#FFFcf7]" : "bg-[#B45309] text-white"
                    }`}
                  >
                    {pkg.ok ? "صالحة" : "أخطاء"}
                  </span>
                </div>
                {pkg.manifest ? (
                  <p className="mt-1 font-mono text-xs text-[rgba(14,52,53,0.6)]">
                    {pkg.manifest.id}@{pkg.manifest.version} · {pkg.manifest.kind}
                  </p>
                ) : null}
                {!pkg.ok ? (
                  <p className="mt-1 text-xs text-[#B45309]">{pkg.errors.join("، ")}</p>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        {/* محرك الامتثال (§15) */}
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-[#0E3435]">محرك الامتثال (§15)</h2>
          <div className="rounded-xl border border-[rgba(14,52,53,0.1)] bg-white p-3">
            <p className="text-sm text-[#0E3435]">
              قواعد مسجّلة: <strong>{compliance.total}</strong> · معتمدة:{" "}
              <strong>{compliance.authoritative}</strong> · نموذجيّة:{" "}
              <strong>{compliance.demo}</strong>
            </p>
            <p className="mt-1 text-xs text-[rgba(14,52,53,0.6)]">
              النطاقات: {compliance.subjects.join("، ")}
            </p>
            <p className="mt-2 rounded bg-[#FEF3C7] px-2 py-1 text-xs text-[#92400E]">
              القواعد الحالية نموذجيّة غير معتمدة — تُستبدل بأساسٍ رسميّ عند اعتماده (§75/§76).
            </p>
          </div>
        </section>

        {/* التوافق والإصدارات (§27) */}
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-[#0E3435]">التوافق والإصدارات (§27)</h2>
          <div className="flex flex-wrap gap-2">
            {COMPATIBILITY_MATRIX.map((c) => (
              <span
                key={c.component}
                className="rounded-md bg-white px-2 py-1 font-mono text-xs text-[#0E3435] ring-1 ring-[rgba(14,52,53,0.1)]"
              >
                {c.component}@{c.version}
              </span>
            ))}
          </div>
          <p className="mt-2 text-xs text-[rgba(14,52,53,0.55)]">
            إهمالات مُعلنة: {DEPRECATIONS.length} · مقاييس التشغيل عبر <code className="rounded bg-[#F7F2EA] px-1">/api/metrics</code>
          </p>
        </section>

        {/* تصنيف البيانات (§21) */}
        <section className="mb-4">
          <h2 className="mb-3 text-lg font-semibold text-[#0E3435]">تصنيف البيانات (§21)</h2>
          <div className="flex flex-wrap gap-2">
            {Object.entries(DATA_CLASS_LABELS_AR).map(([k, label]) => (
              <span
                key={k}
                className="rounded-md bg-white px-2 py-1 text-xs text-[#0E3435] ring-1 ring-[rgba(14,52,53,0.1)]"
              >
                {label} <span className="text-[rgba(14,52,53,0.5)]">({k})</span>
              </span>
            ))}
          </div>
          <p className="mt-2 text-xs text-[rgba(14,52,53,0.55)]">
            سياسة أوّليّة: وسمٌ لا حجب. غياب التصنيف يُعامَل «داخليّ».
          </p>
        </section>
      </main>
    </AdminPageShell>
  );
}

import { AdminPageShell } from "@/components/admin/AdminPageShell";
import { requirePagePermission } from "@/lib/modules/auth/session";
import { listRasdSources } from "@/lib/modules/rasd/admin-data";
import { describeAllConnectors } from "@/lib/modules/rasd/connectors";
import { getRasdFeatureFlagSnapshot } from "@/lib/modules/rasd/flags";
import type { RasdSourceCode } from "@/lib/modules/rasd/types";

export const dynamic = "force-dynamic";

function text(value: unknown): string {
  if (value instanceof Date) return value.toLocaleString("ar-SA");
  return value == null ? "—" : String(value);
}

function certificationLabel(certification: string): string {
  switch (certification) {
    case "VERIFIED_WITH_LIMITATIONS":
      return "متحقق حيًا بحدود";
    case "DEGRADED":
      return "متدهور — غير متحقق حيًا";
    case "DISABLED":
      return "معطّل";
    default:
      return "غير متحقق";
  }
}

export default async function RasdSourcesPage() {
  await requirePagePermission("RASD_VIEW");
  const sources = await listRasdSources();
  const registry = describeAllConnectors();
  const flags = getRasdFeatureFlagSnapshot();
  const byCode = new Map(sources.map((source) => [String(source.code), source]));

  return (
    <AdminPageShell currentPath="/admin/rasd/sources">
      <section dir="rtl">
        <h1 className="text-3xl font-bold text-[#0E3435]">مصادر رصد</h1>
        <p className="mt-2 text-sm text-[rgba(14,52,53,0.65)]">
          حالة الموصلات الرسمية. وجود موصل برمجي لا يعني نجاح الاتصال الحي.
        </p>
        <p className="mt-1 text-xs text-[rgba(14,52,53,0.55)]">
          الأعلام: UQN={String(flags.RASD_SOURCE_UQN_ENABLED)} · BOE=
          {String(flags.RASD_SOURCE_BOE_ENABLED)} · NCAR={String(flags.RASD_SOURCE_NCAR_ENABLED)} ·
          auto-apply={String(flags.RASD_AUTO_APPLY_ENABLED)}
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {registry.map((item) => {
            const db = byCode.get(item.code);
            return (
              <article key={item.code} className="rounded-[0.75rem] border border-[rgba(14,52,53,0.1)] bg-[#FFFcf7] p-5">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-lg font-bold text-[#0E3435]">{item.displayNameAr}</h2>
                  <span className="text-xs text-[rgba(14,52,53,0.55)]">{item.code}</span>
                </div>
                <p className="mt-2 text-sm">التنفيذ: {item.implementation}</p>
                <p className="text-sm">التحقق الحي: {item.live}</p>
                <p className="text-sm">الاعتماد: {certificationLabel(item.certification)}</p>
                <p className="text-sm">مفعّل بالعلم: {item.enabled ? "نعم" : "لا"}</p>
                <p className="text-sm">
                  وثائق حية مختبرة:{" "}
                  {item.liveDocumentsVerified == null ? "—" : item.liveDocumentsVerified.toLocaleString("ar-SA")}
                </p>
                {item.notLiveReason ? (
                  <p className="mt-2 text-sm text-[#8B3A2A]">سبب عدم التحقق: {item.notLiveReason}</p>
                ) : null}
                {db ? (
                  <>
                    <p className="mt-2 text-sm text-[rgba(14,52,53,0.65)]">صحة DB: {text(db.healthStatus)}</p>
                    <p className="text-sm text-[rgba(14,52,53,0.65)]">الأولوية: {text(db.trustPriority)}</p>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-[rgba(14,52,53,0.55)]">لم يُزرع سجل المصدر في DB بعد.</p>
                )}
                <ul className="mt-3 list-disc pr-5 text-xs text-[rgba(14,52,53,0.6)]">
                  {item.notes.slice(0, 2).map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
        <p className="mt-6 text-xs text-[rgba(14,52,53,0.5)]">
          تحذير: BOE وNCAR ليسا CONNECTED / WORKING / LIVE / VERIFIED حتى ينجح تشغيل حي موثّق.
        </p>
        {/* keep type reference for exhaustiveness */}
        <span className="hidden">{(["BOE", "NCAR", "UQN"] as RasdSourceCode[]).join(",")}</span>
      </section>
    </AdminPageShell>
  );
}

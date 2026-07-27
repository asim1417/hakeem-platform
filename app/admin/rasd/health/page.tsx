import { AdminPageShell } from "@/components/admin/AdminPageShell";
import { requirePagePermission } from "@/lib/modules/auth/session";
import { healthCheckAllSources } from "@/lib/modules/rasd/health";
import { listCircuits } from "@/lib/modules/rasd/connectors/circuit-breaker";
import { getRasdFeatureFlagSnapshot } from "@/lib/modules/rasd/flags";
import { listRasdRuns } from "@/lib/modules/rasd/admin-data";

export const dynamic = "force-dynamic";

function tone(ok: boolean | undefined): string {
  if (ok === true) return "text-emerald-800";
  if (ok === false) return "text-[#8B3A2A]";
  return "text-[rgba(14,52,53,0.55)]";
}

export default async function RasdHealthPage() {
  await requirePagePermission("RASD_VIEW");
  const [sources, runs, flags] = await Promise.all([
    healthCheckAllSources(),
    listRasdRuns(8),
    Promise.resolve(getRasdFeatureFlagSnapshot())
  ]);
  const circuits = listCircuits();

  return (
    <AdminPageShell currentPath="/admin/rasd/health">
      <section dir="rtl">
        <h1 className="text-3xl font-bold text-[#0E3435]">صحة رصد</h1>
        <p className="mt-2 text-sm text-[rgba(14,52,53,0.65)]">
          حالة المصادر الحية، القواطع، والأعلام. وجود موصل برمجي لا يعني نجاح الاتصال.
        </p>
        <p className="mt-1 text-xs text-[rgba(14,52,53,0.55)]">
          RASD_ENABLED={String(flags.RASD_ENABLED)} · scheduler={String(flags.RASD_SCHEDULER_ENABLED)} ·
          auto-apply={String(flags.RASD_AUTO_APPLY_ENABLED)}
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {sources.map((source) => (
            <article key={source.sourceCode} className="rounded-[0.75rem] border border-[rgba(14,52,53,0.1)] bg-[#FFFcf7] p-5">
              <h2 className="text-lg font-bold text-[#0E3435]">{source.displayName}</h2>
              <p className={`mt-2 text-sm ${tone(source.ok)}`}>probe: {source.outcome ?? (source.ok ? "OK" : "FAIL")}</p>
              <p className="text-sm">certification: {source.certification}</p>
              <p className="text-sm">live: {source.live}</p>
              <p className="text-sm">enabled: {source.enabled ? "yes" : "no"}</p>
              {source.error ? <p className="mt-2 text-xs text-[#8B3A2A]">{source.error}</p> : null}
            </article>
          ))}
        </div>

        <h2 className="mt-8 text-xl font-bold text-[#0E3435]">Circuit breakers</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {circuits.length === 0 ? (
            <p className="text-sm text-[rgba(14,52,53,0.55)]">لا توجد قواطع مفعّلة في هذه العملية بعد.</p>
          ) : (
            circuits.map((circuit) => (
              <article key={circuit.sourceCode} className="rounded-[0.75rem] border border-[rgba(14,52,53,0.1)] bg-white p-4 text-sm">
                <p className="font-bold">{circuit.sourceCode}</p>
                <p>state: {circuit.state}</p>
                <p>failures: {circuit.failures}</p>
                {circuit.lastError ? <p className="text-[#8B3A2A]">{circuit.lastError}</p> : null}
              </article>
            ))
          )}
        </div>

        <h2 className="mt-8 text-xl font-bold text-[#0E3435]">آخر التشغيلات</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {runs.length === 0 ? (
            <li className="text-[rgba(14,52,53,0.55)]">لا تشغيلات بعد.</li>
          ) : (
            runs.map((run) => (
              <li key={String(run.id)} className="rounded border border-[rgba(14,52,53,0.08)] bg-white px-3 py-2">
                {String(run.runType)} · {String(run.status)} · {String(run.id)}
              </li>
            ))
          )}
        </ul>
      </section>
    </AdminPageShell>
  );
}

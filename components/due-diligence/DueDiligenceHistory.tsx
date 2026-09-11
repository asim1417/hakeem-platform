import Link from "next/link";
import { getCurrentUser } from "@/lib/modules/auth/session";
import {
  compareDueDiligenceSnapshots,
  parseDueDiligenceSnapshotMeta,
} from "@/lib/modules/due-diligence/changes";
import { listDueDiligenceSnapshots } from "@/lib/modules/due-diligence/history";

function formatDate(value: string | Date | undefined) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ar-SA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Riyadh",
  }).format(date);
}

function deltaLabel(value: number | null, suffix = "") {
  if (value === null || value === 0) return null;
  return `${value > 0 ? "+" : ""}${value}${suffix}`;
}

export async function DueDiligenceHistory() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return null;

  const snapshots = await listDueDiligenceSnapshots(user.id, 40).catch(() => []);
  if (!snapshots.length) return null;

  const grouped = new Map<string, typeof snapshots>();
  for (const snapshot of snapshots) {
    const key = snapshot.entityId ?? snapshot.id;
    const group = grouped.get(key) ?? [];
    group.push(snapshot);
    grouped.set(key, group);
  }

  const latestEntities = [...grouped.values()].slice(0, 8).map((group) => {
    const current = group[0];
    const previous = group[1];
    const currentMeta = parseDueDiligenceSnapshotMeta(current?.metadata);
    const previousMeta = parseDueDiligenceSnapshotMeta(previous?.metadata);
    return {
      current,
      currentMeta,
      change: currentMeta ? compareDueDiligenceSnapshots(currentMeta, previousMeta) : null,
      previousAt: previousMeta?.generatedAt ?? previous?.createdAt,
    };
  });

  return (
    <section className="mx-auto mt-6 max-w-6xl px-4 pb-10" dir="rtl" aria-labelledby="dd-history-title">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-emerald-700">سجل الفحوص والتغيّر</p>
            <h2 id="dd-history-title" className="mt-1 text-xl font-bold text-slate-950">آخر تقارير العناية الواجبة</h2>
            <p className="mt-1 text-sm text-slate-500">
              تُحفظ الفحوص الحية فقط. عند تكرار فحص الكيان يقارن حكيم النتيجة تلقائيًا بالفحص السابق ولا يعتبر اختفاء دليل إثباتًا لزوال الواقعة.
            </p>
          </div>
          <Link href="/audit-logs" className="text-sm font-semibold text-emerald-800 underline underline-offset-4">
            سجل التدقيق الكامل
          </Link>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {latestEntities.map(({ current, currentMeta: meta, change, previousAt }) => {
            const name = meta?.query?.name || "فحص كيان";
            const score = meta?.risk?.score;
            const successful = meta?.coverage?.successfulSources;
            const configured = meta?.coverage?.configuredSources;
            const riskDelta = change ? deltaLabel(change.riskDelta) : null;
            const newFindings = (change?.addedEvidence.length ?? 0) + (change?.addedNeedsReview.length ?? 0);
            const noLongerObserved =
              (change?.noLongerObservedEvidence.length ?? 0) +
              (change?.noLongerObservedNeedsReview.length ?? 0);

            return (
              <article key={current.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-slate-950">{name}</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      {meta?.query?.commercialRegistration
                        ? `سجل: ${meta.query.commercialRegistration}`
                        : meta?.query?.unifiedNumber
                          ? `رقم موحد: ${meta.query.unifiedNumber}`
                          : "بحث بالاسم"}
                    </p>
                  </div>
                  <div className="rounded-xl bg-white px-3 py-2 text-center shadow-sm">
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-lg font-black text-slate-950">{typeof score === "number" ? score : "—"}</span>
                      {riskDelta ? (
                        <span className={`text-[10px] font-bold ${change && (change.riskDelta ?? 0) > 0 ? "text-rose-700" : "text-emerald-700"}`}>
                          {riskDelta}
                        </span>
                      ) : null}
                    </div>
                    <div className="text-[10px] text-slate-500">Risk / 100</div>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                  <span>{formatDate(meta?.generatedAt ?? current.createdAt)}</span>
                  {typeof successful === "number" && typeof configured === "number" ? (
                    <span>المصادر: {successful}/{configured}</span>
                  ) : null}
                  {typeof meta?.coverage?.verifiedEvidence === "number" ? (
                    <span>أدلة متحققة: {meta.coverage.verifiedEvidence}</span>
                  ) : null}
                </div>

                {change ? (
                  <div className="mt-4 border-t border-slate-200 pt-3">
                    {change.baseline ? (
                      <span className="inline-flex rounded-full bg-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                        خط أساس — أول فحص محفوظ
                      </span>
                    ) : change.hasMaterialChange ? (
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-2 text-[11px] font-semibold">
                          {newFindings > 0 ? (
                            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-800">جديد: {newFindings}</span>
                          ) : null}
                          {noLongerObserved > 0 ? (
                            <span className="rounded-full bg-slate-200 px-2.5 py-1 text-slate-700">لم يعد ظاهرًا: {noLongerObserved}</span>
                          ) : null}
                          {change.sourceStatusChanges.length > 0 ? (
                            <span className="rounded-full bg-sky-100 px-2.5 py-1 text-sky-800">تغير مصادر: {change.sourceStatusChanges.length}</span>
                          ) : null}
                          {change.verifiedEvidenceDelta ? (
                            <span className="rounded-full bg-violet-100 px-2.5 py-1 text-violet-800">
                              الأدلة المتحققة {deltaLabel(change.verifiedEvidenceDelta)}
                            </span>
                          ) : null}
                        </div>
                        <p className="text-[11px] leading-5 text-slate-500">
                          مقارنة بالفحص السابق: {formatDate(previousAt)}. «لم يعد ظاهرًا» لا يعني أن الواقعة انتهت؛ قد يتغير المصدر أو نطاق التغطية.
                        </p>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-2 text-[11px] text-emerald-800">
                        <span className="font-semibold">لا تغيّر جوهري منذ الفحص السابق</span>
                        <span className="text-slate-500">{formatDate(previousAt)}</span>
                      </div>
                    )}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

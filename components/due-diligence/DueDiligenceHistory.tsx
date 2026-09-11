import Link from "next/link";
import { getCurrentUser } from "@/lib/modules/auth/session";
import { listDueDiligenceSnapshots } from "@/lib/modules/due-diligence/history";

type SnapshotMeta = {
  kind?: string;
  query?: { name?: string; commercialRegistration?: string | null; unifiedNumber?: string | null };
  generatedAt?: string;
  risk?: { score?: number; level?: string };
  coverage?: { successfulSources?: number; configuredSources?: number; verifiedEvidence?: number };
};

function asMeta(value: unknown): SnapshotMeta | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as SnapshotMeta;
}

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

export async function DueDiligenceHistory() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return null;

  const snapshots = await listDueDiligenceSnapshots(user.id, 8).catch(() => []);
  if (!snapshots.length) return null;

  return (
    <section className="mx-auto mt-6 max-w-6xl px-4 pb-10" dir="rtl" aria-labelledby="dd-history-title">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-emerald-700">سجل الفحوص</p>
            <h2 id="dd-history-title" className="mt-1 text-xl font-bold text-slate-950">آخر تقارير العناية الواجبة</h2>
            <p className="mt-1 text-sm text-slate-500">تُحفظ الفحوص الحية فقط، وتبقى البيانات التجريبية خارج السجل.</p>
          </div>
          <Link href="/audit-logs" className="text-sm font-semibold text-emerald-800 underline underline-offset-4">
            سجل التدقيق الكامل
          </Link>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {snapshots.map((snapshot) => {
            const meta = asMeta(snapshot.metadata);
            const name = meta?.query?.name || "فحص كيان";
            const score = meta?.risk?.score;
            const successful = meta?.coverage?.successfulSources;
            const configured = meta?.coverage?.configuredSources;
            return (
              <article key={snapshot.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
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
                    <div className="text-lg font-black text-slate-950">{typeof score === "number" ? score : "—"}</div>
                    <div className="text-[10px] text-slate-500">Risk / 100</div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                  <span>{formatDate(meta?.generatedAt ?? snapshot.createdAt)}</span>
                  {typeof successful === "number" && typeof configured === "number" ? (
                    <span>المصادر: {successful}/{configured}</span>
                  ) : null}
                  {typeof meta?.coverage?.verifiedEvidence === "number" ? (
                    <span>أدلة متحققة: {meta.coverage.verifiedEvidence}</span>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

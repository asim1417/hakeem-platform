import { requirePagePermission } from "@/lib/modules/auth/session";
import { hybridSearch, type HybridSearchResponse } from "@/lib/modules/legal-search/hybrid-search";

export const dynamic = "force-dynamic";

const SOURCE_LABELS: Record<string, string> = {
  postgres: "نصّي",
  vector: "دلالي",
  knowledge_graph: "رسم معرفي",
  opensearch: "OpenSearch",
};
const TYPE_LABELS: Record<string, string> = { article: "مادة", ruling: "حكم", principle: "مبدأ" };

export default async function LegalSearchPage({ searchParams }: { searchParams: { q?: string } }) {
  await requirePagePermission("LEGAL_CORE_VIEW");

  const q = (searchParams.q ?? "").trim();
  let data: HybridSearchResponse | null = null;
  if (q.length >= 2) {
    try {
      data = await hybridSearch({ q, limit: 20 });
    } catch {
      data = null;
    }
  }

  return (
    <div dir="rtl">
      <p className="text-sm font-semibold text-gold">البحث القانوني الهجين (Hybrid Legal Search)</p>
      <h1 className="mt-2 text-3xl font-bold text-olive">صفحة اختبار البحث الموحّد</h1>
      <p className="mt-3 max-w-3xl leading-8 text-gray-700">
        يجمع البحث: النصّي (PostgreSQL) + الدلالي (pgvector) + الرسم المعرفي + OpenSearch (إن توفّر) —
        دون الارتهان لمحرك واحد. صفحة فنية للتحقق.
      </p>

      <form className="mt-6 flex flex-wrap items-center gap-2" action="/dashboard/legal-search">
        <input
          name="q"
          defaultValue={q}
          placeholder="ابحث في الأنظمة والأحكام والمبادئ…"
          className="min-w-[280px] flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded-md bg-olive px-5 py-2 text-sm text-white">بحث</button>
      </form>

      {/* حالة المزوّدات */}
      {data && (
        <div className="mt-5 flex flex-wrap gap-2">
          {data.providers.map((p) => (
            <span
              key={p.name}
              className={`rounded-full px-3 py-1 text-xs ${
                p.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-400"
              }`}
            >
              {SOURCE_LABELS[p.name] ?? p.name}: {p.status === "active" ? "متاح" : "غير متاح"}
            </span>
          ))}
          <span className="rounded-full bg-gold/10 px-3 py-1 text-xs text-gold">الوضع: {data.mode}</span>
        </div>
      )}

      {/* النتائج */}
      {data && (
        <div className="mt-5 space-y-3">
          {data.results.length === 0 ? (
            <p className="text-gray-400">لا توجد نتائج.</p>
          ) : (
            data.results.map((r) => (
              <div key={`${r.type}:${r.id}`} className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-gold/10 px-1.5 py-0.5 text-xs text-gold">{TYPE_LABELS[r.type] ?? r.type}</span>
                  <span className="font-semibold text-olive">{r.title}</span>
                  <span className="ms-auto rounded bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700 tabular-nums">
                    ثقة {(r.confidence * 100).toFixed(0)}%
                  </span>
                </div>
                {r.snippet && <p className="mt-2 line-clamp-2 text-sm text-gray-600">{r.snippet}</p>}
                <div className="mt-2 flex flex-wrap items-center gap-1 text-xs text-gray-500">
                  المصادر:
                  {r.sources.map((s) => (
                    <span key={s} className="rounded bg-gray-100 px-1.5 py-0.5">{SOURCE_LABELS[s] ?? s}</span>
                  ))}
                </div>
                <div className="mt-1 text-xs text-gray-400">سبب المطابقة: {r.reasons.join(" · ")}</div>
              </div>
            ))
          )}
        </div>
      )}

      {q.length >= 2 && !data && (
        <div className="mt-6 rounded-md border border-amber-300 bg-amber-50 p-4 text-amber-800">
          ⚠ تعذّر تشغيل البحث (قد تكون جداول/امتدادات القاعدة غير مُفعّلة محلياً بعد).
        </div>
      )}
    </div>
  );
}

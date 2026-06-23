import Link from "next/link";
import { Search, FileText, Scale, Quote, ExternalLink, Filter, X } from "lucide-react";
import { requirePagePermission } from "@/lib/modules/auth/session";
import { hybridSearch, type HybridSearchResponse, type MergedResult } from "@/lib/modules/legal-search/hybrid-search";
import { recordSearch } from "@/lib/modules/legal-search/search-log";
import { LegalPageHeader, LegalAlert } from "@/components/ui/legal";
import { HighlightedSearchText, joinSearchTerms } from "@/components/SearchHighlight";
import { TurathSourcesPanel } from "@/components/turath/TurathSourcesPanel";

export const dynamic = "force-dynamic";

const SOURCE_LABELS: Record<string, string> = {
  postgres: "نصّي",
  vector: "دلالي",
  knowledge_graph: "رسم معرفي",
  opensearch: "OpenSearch",
};

type EntityType = "article" | "ruling" | "principle";
const TYPE_META: Record<EntityType, { label: string; icon: typeof FileText; tone: string }> = {
  article: { label: "مادة", icon: FileText, tone: "var(--navy)" },
  ruling: { label: "حكم", icon: Scale, tone: "var(--gold-dark)" },
  principle: { label: "مبدأ", icon: Quote, tone: "var(--emerald)" },
};

const FILTERS: Array<{ key: string; label: string }> = [
  { key: "all", label: "الكل" },
  { key: "article", label: "المواد" },
  { key: "ruling", label: "الأحكام" },
  { key: "principle", label: "المبادئ" },
];

function metaStr(r: MergedResult, key: string): string | null {
  const v = (r.meta as Record<string, unknown> | undefined)?.[key];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** يبني قائمة تسهيلات (facets) مرتّبة بالعدد التنازلي. */
function facetsOf(rows: MergedResult[], key: string): Array<{ value: string; count: number }> {
  const map = new Map<string, number>();
  for (const r of rows) {
    const v = metaStr(r, key);
    if (v) map.set(v, (map.get(v) ?? 0) + 1);
  }
  return [...map.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count);
}

function detailHref(r: MergedResult): string | null {
  if (r.type === "article") return `/dashboard/legal-core/articles/${r.id}`;
  if (r.type === "ruling") return `/dashboard/legal-core/judgments/${r.id}`;
  return null; // المبادئ بلا صفحة تفصيل مستقلّة بعد
}

export default async function LegalSearchPage({
  searchParams,
}: {
  searchParams: { q?: string; type?: string; system?: string; court?: string };
}) {
  await requirePagePermission("LEGAL_CORE_VIEW");

  const q = (searchParams.q ?? "").trim();
  const activeType = FILTERS.some((f) => f.key === searchParams.type) ? searchParams.type! : "all";
  const activeSystem = (searchParams.system ?? "").trim();
  const activeCourt = (searchParams.court ?? "").trim();
  const highlightTerms = joinSearchTerms(q);

  let data: HybridSearchResponse | null = null;
  let failed = false;
  if (q.length >= 2) {
    try {
      data = await hybridSearch({ q, limit: 30 });
      await recordSearch({
        query: q,
        filters: {
          ...(activeType !== "all" ? { type: activeType } : {}),
          ...(activeSystem ? { system: activeSystem } : {}),
          ...(activeCourt ? { court: activeCourt } : {}),
        },
        resultsCount: data.results.length,
      });
    } catch {
      failed = true;
    }
  }

  const all = data?.results ?? [];
  const counts: Record<string, number> = {
    all: all.length,
    article: all.filter((r) => r.type === "article").length,
    ruling: all.filter((r) => r.type === "ruling").length,
    principle: all.filter((r) => r.type === "principle").length,
  };

  // تسهيلات الفلترة (من كامل النتائج كي لا تختفي الخيارات)
  const systemFacets = facetsOf(all.filter((r) => r.type === "article"), "systemName");
  const courtFacets = facetsOf(all.filter((r) => r.type === "ruling"), "court");

  // الفلترة: النوع + النظام (يضيّق المواد) + المحكمة (تضيّق الأحكام)
  const results = all.filter((r) => {
    if (activeType !== "all" && r.type !== activeType) return false;
    if (activeSystem && r.type === "article" && metaStr(r, "systemName") !== activeSystem) return false;
    if (activeCourt && r.type === "ruling" && metaStr(r, "court") !== activeCourt) return false;
    return true;
  });

  const hasActiveFilter = activeType !== "all" || Boolean(activeSystem) || Boolean(activeCourt);
  // يبني رابطًا يحافظ على بقية الفلاتر مع تبديل النوع.
  const typeHref = (typeKey: string) => {
    const p = new URLSearchParams();
    p.set("q", q);
    if (typeKey !== "all") p.set("type", typeKey);
    if (activeSystem) p.set("system", activeSystem);
    if (activeCourt) p.set("court", activeCourt);
    return `/dashboard/legal-search?${p.toString()}`;
  };

  return (
    <div dir="rtl">
      <LegalPageHeader
        eyebrow="البحث القانوني الشامل"
        title="ابحث في كامل القاعدة القانونية"
        description="بحث موحّد عبر الأنظمة والمواد والأحكام والمبادئ في آنٍ واحد — يجمع البحث النصّي والدلالي والعلائقي ويرتّب النتائج حسب الصلة. ابحث أولاً ثم ضيّق بالفلاتر."
      />

      {/* صندوق البحث المركزي */}
      <form className="card mt-6" action="/dashboard/legal-search">
        {activeType !== "all" ? <input type="hidden" name="type" value={activeType} /> : null}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-[var(--r-md)] border border-[var(--ink-20)] bg-white px-3 focus-within:border-[var(--gold)] focus-within:ring-2 focus-within:ring-[var(--gold-ghost)]">
            <Search size={18} className="text-[var(--ink-40)]" />
            <input
              name="q"
              defaultValue={q}
              placeholder="اكتب رقم مادة، اسم نظام، رقم حكم، أو سؤالاً قانونياً طبيعياً…"
              className="h-11 w-full border-0 bg-transparent text-sm text-[var(--ink)] outline-none placeholder:text-[var(--ink-40)]"
              autoFocus
            />
          </div>
          <button type="submit" className="btn btn-gold">
            <Search size={16} /> ابحث
          </button>
        </div>
      </form>

      {/* فلاتر نوع الكيان (بعد ظهور النتائج) */}
      {data && all.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {FILTERS.map((f) => {
            const isActive = f.key === activeType;
            return (
              <Link
                key={f.key}
                href={typeHref(f.key)}
                className={`rounded-full border px-4 py-1.5 text-sm transition ${
                  isActive
                    ? "border-[var(--navy)] bg-[var(--navy)] text-white"
                    : "border-[var(--ink-20)] bg-white text-[var(--ink-80)] hover:border-[var(--gold)]"
                }`}
              >
                {f.label} <span className="tabular-nums opacity-70">({counts[f.key].toLocaleString("ar-SA")})</span>
              </Link>
            );
          })}
        </div>
      )}

      {/* الفلاتر المتقدمة: النظام + المحكمة (مشتقّة من النتائج) */}
      {data && (systemFacets.length > 0 || courtFacets.length > 0) && (
        <form action="/dashboard/legal-search" className="mt-3 flex flex-wrap items-center gap-2 rounded-[var(--r-md)] border border-[var(--ink-08)] bg-[var(--paper)] p-3">
          <input type="hidden" name="q" value={q} />
          {activeType !== "all" ? <input type="hidden" name="type" value={activeType} /> : null}
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--ink-60)]">
            <Filter size={14} className="text-[var(--gold)]" /> تصفية متقدّمة
          </span>
          {systemFacets.length > 0 && (
            <select
              name="system"
              defaultValue={activeSystem}
              className="rounded-[var(--r-md)] border border-[var(--ink-20)] bg-white px-3 py-1.5 text-sm text-[var(--ink-80)] outline-none focus:border-[var(--gold)]"
            >
              <option value="">كل الأنظمة</option>
              {systemFacets.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.value} ({f.count})
                </option>
              ))}
            </select>
          )}
          {courtFacets.length > 0 && (
            <select
              name="court"
              defaultValue={activeCourt}
              className="rounded-[var(--r-md)] border border-[var(--ink-20)] bg-white px-3 py-1.5 text-sm text-[var(--ink-80)] outline-none focus:border-[var(--gold)]"
            >
              <option value="">كل المحاكم</option>
              {courtFacets.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.value} ({f.count})
                </option>
              ))}
            </select>
          )}
          <button type="submit" className="btn btn-primary px-4 py-1.5 text-sm">تطبيق</button>
          {hasActiveFilter && (
            <Link
              href={`/dashboard/legal-search?q=${encodeURIComponent(q)}`}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--ruby)] hover:underline"
            >
              <X size={13} /> إعادة الضبط
            </Link>
          )}
        </form>
      )}

      {/* حالة المزوّدات + عدد النتائج */}
      {data && (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold text-[var(--ink-80)]">
            {results.length.toLocaleString("ar-SA")} نتيجة
          </span>
          <span className="text-[var(--ink-40)]">·</span>
          {data.providers.map((p) => (
            <span
              key={p.name}
              className={`rounded-full px-2.5 py-0.5 ${
                p.status === "active"
                  ? "border border-[rgba(26,92,65,.25)] bg-[var(--emerald-soft)] text-[var(--emerald)]"
                  : "border border-[var(--ink-08)] bg-[var(--ink-04)] text-[var(--ink-40)]"
              }`}
            >
              {SOURCE_LABELS[p.name] ?? p.name}: {p.status === "active" ? "متاح" : "غير متاح"}
            </span>
          ))}
        </div>
      )}

      {/* تنويه بيانات الأحكام التجريبية */}
      {data && counts.ruling > 0 && (
        <div className="mt-4">
          <LegalAlert tone="warning">
            بعض نتائج الأحكام والمبادئ هي <strong>عيّنة تجريبية موسومة</strong> 【عيّنة تجريبية】 لأغراض العرض، وتُستبدل تلقائياً ببيانات الأحكام الحقيقية عند استيرادها.
          </LegalAlert>
        </div>
      )}

      {/* النتائج */}
      {data && (
        <div className="mt-5 space-y-3">
          {results.length === 0 ? (
            <div className="card text-center">
              <p className="t-display font-bold text-[var(--navy)]">لا توجد نتائج مطابقة</p>
              <p className="mt-2 text-sm text-[var(--ink-60)]">جرّب كلمات أعمّ، أو أزل الفلتر، أو أعد صياغة السؤال.</p>
            </div>
          ) : (
            results.map((r) => {
              const meta = TYPE_META[r.type as EntityType] ?? TYPE_META.article;
              const Icon = meta.icon;
              const href = detailHref(r);
              return (
                <article key={`${r.type}:${r.id}`} className="card transition hover:-translate-y-0.5 hover:shadow-[var(--sh-md)]">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold text-white"
                      style={{ background: meta.tone }}
                    >
                      <Icon size={12} /> {meta.label}
                    </span>
                    <h3 className="t-display font-bold text-[var(--navy)]">{r.title}</h3>
                    <span className="ms-auto rounded-full border border-[rgba(26,92,65,.25)] bg-[var(--emerald-soft)] px-2.5 py-0.5 text-xs font-semibold text-[var(--emerald)] tabular-nums">
                      الصلة {(r.confidence * 100).toFixed(0)}%
                    </span>
                  </div>

                  {r.snippet && (
                    <p className="mt-2 line-clamp-2 leading-7 text-sm text-[var(--ink-80)]">
                      <HighlightedSearchText text={r.snippet} terms={highlightTerms} />
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--ink-60)]">
                    <span className="text-[var(--ink-40)]">المصادر:</span>
                    {r.sources.map((s) => (
                      <span key={s} className="rounded bg-[var(--ink-04)] px-1.5 py-0.5">{SOURCE_LABELS[s] ?? s}</span>
                    ))}
                    {r.reasons.length > 0 && (
                      <>
                        <span className="text-[var(--ink-20)]">·</span>
                        <span>سبب الظهور: {r.reasons.join(" · ")}</span>
                      </>
                    )}
                    {href && (
                      <Link href={href} className="ms-auto inline-flex items-center gap-1 font-semibold text-[var(--gold-dark)] hover:text-[var(--navy)]">
                        فتح التفاصيل <ExternalLink size={13} />
                      </Link>
                    )}
                  </div>
                </article>
              );
            })
          )}
        </div>
      )}

      {/* مصادر فقهية حيّة من مكتبة تراث (تظهر عند وجود عبارة بحث) */}
      {q.length >= 2 && <TurathSourcesPanel query={q} />}

      {/* حالة فارغة قبل البحث */}
      {!data && !failed && (
        <div className="mt-6 rounded-[var(--r-md)] border border-dashed border-[var(--gold-border)] bg-[var(--gold-ghost)] p-8 text-center">
          <Search size={28} className="mx-auto text-[var(--gold)]" />
          <p className="t-display mt-3 font-bold text-[var(--navy)]">ابدأ بكتابة عبارة بحث</p>
          <p className="mt-2 text-sm text-[var(--ink-60)]">
            مثال: «أحكام فسخ العقد» · «المادة المتعلقة بالتقادم» · «التعويض عن الضرر العقدي»
          </p>
        </div>
      )}

      {/* حالة الخطأ */}
      {failed && (
        <div className="mt-6">
          <LegalAlert tone="danger">
            تعذّر تشغيل البحث حالياً. حاول مرة أخرى، فإن تكرّر الأمر فقد تكون خدمة البحث قيد الصيانة.
          </LegalAlert>
        </div>
      )}
    </div>
  );
}

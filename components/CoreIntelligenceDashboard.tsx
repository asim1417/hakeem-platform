"use client";

import { useCallback, useEffect, useState } from "react";

// مركز التشغيل الذكي للنواة القانونية — ربط واجهي فوق الخدمات القائمة فقط.
// لا منطق محرّكات هنا؛ كل تشغيل عبر استدعاء API قائم. غياب البيانات يُظهر حالة واضحة لا كسرًا.

type Summary = {
  systemsCount: number;
  articlesCount: number;
  rulingsCount: number;
  classificationsCount: number;
  linkedArticlesCount: number;
  unlinkedArticlesCount: number;
  unlinkedRulingsCount: number;
  reviewNeededCount: number;
  relationsCount: number;
  linkCoveragePercent: number;
  dataQualityScore: number;
  rulingsImportedButUnlinked: boolean;
};

type ArticleResult = {
  id: string;
  systemName: string;
  articleNumber: number | string | null;
  title: string;
  snippet: string;
  citation: string;
  classification: string | null;
};

type SmartAction = {
  key: string;
  label: string;
  kind: "navigate" | "clipboard" | "engine" | "data";
  href?: string;
  clipboard?: string;
  api?: string;
  method?: "POST";
  payload?: Record<string, unknown>;
};

type ArticleIntel = {
  article: { id: string; systemName: string; articleNumber: number | string; title: string; content: string; classification: string | null };
  citation: string;
  relatedRulings: { id: string; title: string; court: string | null; relationType: string; confidence: number | null }[];
  relatedPrinciples: { id: string; title: string; principleText: string }[];
  relations: { id: string; sourceType: string; targetType: string; relation: string; strength: number }[];
  availableActions: SmartAction[];
};

const SEARCH_MODES = [
  { value: "text", label: "نص المادة" },
  { value: "number", label: "رقم المادة" },
  { value: "system", label: "اسم النظام" },
  { value: "topic", label: "الموضوع/التصنيف" },
] as const;

export function CoreIntelligenceDashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [q, setQ] = useState("");
  const [mode, setMode] = useState<(typeof SEARCH_MODES)[number]["value"]>("text");
  const [results, setResults] = useState<ArticleResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  // فلاتر
  const [systemFilter, setSystemFilter] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [needsReviewOnly, setNeedsReviewOnly] = useState(false);

  // اللوحة الجانبية
  const [selected, setSelected] = useState<ArticleResult | null>(null);
  const [intel, setIntel] = useState<ArticleIntel | null>(null);
  const [intelLoading, setIntelLoading] = useState(false);
  const [engineKey, setEngineKey] = useState<string | null>(null);
  const [engineResult, setEngineResult] = useState<{ key: string; text: string; meta: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/legal-core/intelligence-summary")
      .then((r) => r.json())
      .then((d) => (d?.ok ? setSummary(d) : null))
      .catch(() => null);
  }, []);

  const runSearch = useCallback(async () => {
    setLoading(true);
    setSearched(true);
    try {
      const params = new URLSearchParams({ limit: "30", sourceType: "legal_article" });
      if (q.trim()) params.set("query", q.trim());
      const r = await fetch(`/api/legal-core/search?${params.toString()}`);
      const d = await r.json();
      const items: ArticleResult[] = (d?.results ?? [])
        .filter((x: { type?: string }) => x.type === "article")
        .map((x: Record<string, unknown>) => ({
          id: String(x.id),
          systemName: String(x.systemName ?? ""),
          articleNumber: (x.articleNumber as number) ?? null,
          title: String(x.title ?? x.articleTitle ?? ""),
          snippet: String(x.snippet ?? ""),
          citation: String(x.citation ?? x.citationLabel ?? `${x.systemName} — المادة (${x.articleNumber})`),
          classification: (x.classification as string) ?? null,
        }));
      setResults(items);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [q]);

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
    } catch {
      /* المتصفح منع النسخ */
    }
  }

  async function openPanel(article: ArticleResult, autoAction?: string) {
    setSelected(article);
    setIntel(null);
    setEngineResult(null);
    setEngineKey(null);
    setIntelLoading(true);
    try {
      const r = await fetch(`/api/legal-core/article/${article.id}/intelligence`);
      const d = await r.json();
      if (d?.ok) {
        setIntel(d);
        if (autoAction) {
          const action = (d.availableActions as SmartAction[]).find((a) => a.key === autoAction);
          if (action?.kind === "engine") void runEngine(action);
        }
      }
    } catch {
      setIntel(null);
    } finally {
      setIntelLoading(false);
    }
  }

  async function runEngine(action: SmartAction) {
    if (!action.api) return;
    setEngineKey(action.key);
    setEngineResult(null);
    try {
      const r = await fetch(action.api, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action.payload ?? {}),
      });
      const d = await r.json();
      if (!r.ok || d?.ok === false) {
        setEngineResult({ key: action.key, text: d?.error ?? d?.message ?? "تعذّر التشغيل.", meta: "" });
        return;
      }
      const text =
        d.shortAnswer || d.answer || d.caseSummary || d.disputeCharacterization || d.litigationStrategy || d.preliminaryCharacterization || "تم التشغيل.";
      const conf = typeof d.confidence === "number" ? `الثقة ${(d.confidence * 100).toFixed(0)}%` : "";
      const cites = Array.isArray(d.citations) ? `استشهادات ${d.citations.length}` : "";
      const grounded = d.grounded === false ? "غير مُسنَد (مصادر غير كافية)" : "";
      setEngineResult({ key: action.key, text: String(text), meta: [conf, cites, grounded].filter(Boolean).join(" · ") });
    } catch {
      setEngineResult({ key: action.key, text: "تعذّر الاتصال بالخدمة.", meta: "" });
    } finally {
      setEngineKey(null);
    }
  }

  const systems = Array.from(new Set(results.map((r) => r.systemName).filter(Boolean))).sort();
  const classes = Array.from(new Set(results.map((r) => r.classification).filter(Boolean))) as string[];
  const filtered = results.filter((r) => {
    if (systemFilter && r.systemName !== systemFilter) return false;
    if (classFilter && r.classification !== classFilter) return false;
    if (needsReviewOnly && r.classification) return false;
    if (mode === "number" && q.trim() && String(r.articleNumber ?? "") !== q.trim()) return false;
    return true;
  });

  return (
    <div dir="rtl" className="rounded-[var(--r-lg,12px)] border border-[var(--ink-08,#e5e7eb)] bg-ivory p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-xl font-bold text-olive">مركز التشغيل الذكي</h2>
        <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">ربط النواة بخدمات حكيم</span>
      </div>

      {/* لوحة جودة الربط */}
      {summary && (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
            <Stat label="الأنظمة" value={summary.systemsCount} />
            <Stat label="المواد" value={summary.articlesCount} />
            <Stat label="الأحكام" value={summary.rulingsCount} tone={summary.rulingsCount ? "emerald" : "amber"} />
            <Stat label="التصنيفات" value={summary.classificationsCount} />
            <Stat label="تحتاج مراجعة" value={summary.reviewNeededCount} tone={summary.reviewNeededCount ? "amber" : "emerald"} />
            <Stat label="جودة البيانات" value={`${summary.dataQualityScore}%`} tone={summary.dataQualityScore >= 60 ? "emerald" : "amber"} />
          </div>

          <div className="mt-3 rounded-md border border-gray-200 bg-surface p-3">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="font-semibold text-olive">جودة الربط</span>
              <span className="text-ink">مواد مرتبطة بأحكام: <b>{summary.linkedArticlesCount}</b></span>
              <span className="text-ink">مواد بلا أحكام: <b>{summary.unlinkedArticlesCount}</b></span>
              <span className="text-ink">أحكام بلا مواد: <b>{summary.unlinkedRulingsCount}</b></span>
              <span className="text-ink">علاقات معرفية: <b>{summary.relationsCount}</b></span>
              <span className="ms-auto rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-700 tabular-nums">تغطية الربط {summary.linkCoveragePercent}%</span>
            </div>
            {summary.rulingsImportedButUnlinked && (
              <p className="mt-2 rounded bg-amber-50 p-2 text-xs text-amber-800">⚠ توجد أحكام مستوردة لكنها غير مرتبطة بمواد بعد — شغّل ربط الأحكام لإثراء العلاقات.</p>
            )}
          </div>
        </>
      )}

      {/* البحث الموحّد + الفلاتر */}
      <form
        className="mt-4 flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void runSearch();
        }}
      >
        <select value={mode} aria-label="نمط البحث" onChange={(e) => setMode(e.target.value as typeof mode)} className="rounded-md border border-gray-300 px-2 py-2 text-sm">
          {SEARCH_MODES.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
        <input
          value={q} aria-label="بحث النواة القانونية"
          onChange={(e) => setQ(e.target.value)}
          placeholder="ابحث في النواة القانونية…"
          className="min-w-[220px] flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded-md bg-olive px-5 py-2 text-sm text-white">{loading ? "..." : "بحث"}</button>
      </form>

      {(systems.length > 0 || classes.length > 0) && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <select value={systemFilter} aria-label="تصفية بالنظام" onChange={(e) => setSystemFilter(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1.5">
            <option value="">كل الأنظمة</option>
            {systems.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          {classes.length > 0 && (
            <select value={classFilter} aria-label="تصفية بالتصنيف" onChange={(e) => setClassFilter(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1.5">
              <option value="">كل التصنيفات</option>
              {classes.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
          <label className="flex items-center gap-1 text-ink">
            <input type="checkbox" checked={needsReviewOnly} onChange={(e) => setNeedsReviewOnly(e.target.checked)} /> يحتاج مراجعة
          </label>
        </div>
      )}

      {/* النتائج + اللوحة الجانبية */}
      <div className="mt-4 grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-3">
          {!searched && <p className="text-sm text-muted">ابحث لعرض المواد مع أزرار التشغيل الذكي.</p>}
          {searched && !loading && filtered.length === 0 && <p className="text-sm text-muted">لا توجد مواد مطابقة.</p>}
          {filtered.map((a) => (
            <article key={a.id} className={`rounded-lg border p-4 ${selected?.id === a.id ? "border-olive bg-sand/40" : "border-gray-200 bg-ivory"}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-gold/10 px-1.5 py-0.5 text-xs text-gold">مادة</span>
                <span className="font-semibold text-olive">{a.citation}</span>
                {a.classification && <span className="rounded bg-surface px-1.5 py-0.5 text-xs text-muted">{a.classification}</span>}
              </div>
              {a.snippet && <p className="mt-2 line-clamp-2 text-sm leading-7 text-ink">{a.snippet}</p>}
              <div className="mt-3 flex flex-wrap gap-1.5">
                <ActBtn href={`/dashboard/legal-core/articles/${a.id}`}>فتح المادة</ActBtn>
                <ActBtn onClick={() => copy(a.citation, `c-${a.id}`)}>{copied === `c-${a.id}` ? "نُسخ ✓" : "نسخ الاستشهاد"}</ActBtn>
                <ActBtn onClick={() => openPanel(a, "ask")}>اسأل حكيم</ActBtn>
                <ActBtn onClick={() => openPanel(a, "analyze")}>حلّل قضية</ActBtn>
                <ActBtn onClick={() => openPanel(a, "strategy")}>استراتيجية دعوى</ActBtn>
                <ActBtn onClick={() => openPanel(a, "simulate")}>محاكاة قضائية</ActBtn>
                <ActBtn onClick={() => openPanel(a)}>الأحكام/العلاقات</ActBtn>
              </div>
            </article>
          ))}
        </div>

        {/* اللوحة الجانبية: تشغيل ذكي */}
        <aside className="rounded-lg border border-gray-200 bg-ivory p-4">
          <div className="font-semibold text-olive">تشغيل ذكي</div>
          {!selected && <p className="mt-2 text-sm text-muted">اختر مادة لعرض سياقها وتشغيل الخدمات الذكية.</p>}
          {selected && (
            <div className="mt-2 space-y-3">
              <div className="rounded-md bg-sand/50 p-3">
                <div className="text-sm font-semibold text-olive">{selected.citation}</div>
                <button onClick={() => copy(intel?.citation ?? selected.citation, "panel-cite")} className="mt-1 text-xs text-blue-700 underline">
                  {copied === "panel-cite" ? "نُسخ ✓" : "نسخ الاستشهاد"}
                </button>
              </div>

              {intelLoading && <p className="text-sm text-muted">جارٍ التحميل…</p>}

              {intel && (
                <>
                  <div className="flex flex-wrap gap-1.5">
                    <ActBtn onClick={() => { const a = intel.availableActions.find((x) => x.key === "ask"); if (a) void runEngine(a); }}>سؤال سريع</ActBtn>
                    <ActBtn onClick={() => { const a = intel.availableActions.find((x) => x.key === "analyze"); if (a) void runEngine(a); }}>تحليل قضية</ActBtn>
                    <ActBtn onClick={() => { const a = intel.availableActions.find((x) => x.key === "strategy"); if (a) void runEngine(a); }}>توليد دفوع</ActBtn>
                    <ActBtn onClick={() => { const a = intel.availableActions.find((x) => x.key === "simulate"); if (a) void runEngine(a); }}>محاكاة قضائية</ActBtn>
                    <ActBtn onClick={() => copy(`${intel.citation}\n${intel.article.content}`, "ctx")}>{copied === "ctx" ? "نُسخ ✓" : "نسخ السياق"}</ActBtn>
                  </div>

                  {engineKey && <p className="text-sm text-muted">⏳ جارٍ تشغيل الخدمة…</p>}
                  {engineResult && (
                    <div className="rounded-md border border-emerald-200 bg-emerald-50/50 p-3">
                      <p className="whitespace-pre-wrap text-sm leading-7 text-ink">{engineResult.text}</p>
                      {engineResult.meta && <p className="mt-1 text-xs text-muted">{engineResult.meta}</p>}
                    </div>
                  )}

                  <PanelList title="الأحكام المرتبطة" empty="لا توجد روابط كافية حتى الآن لهذه المادة.">
                    {intel.relatedRulings.map((r) => (
                      <li key={r.id} className="border-t border-gray-100 py-1.5 text-sm text-ink">
                        {r.title}{r.court ? ` — ${r.court}` : ""} <span className="text-xs text-muted">({r.relationType})</span>
                      </li>
                    ))}
                  </PanelList>

                  <PanelList title="المبادئ المرتبطة" empty="لا مبادئ مرتبطة بعد.">
                    {intel.relatedPrinciples.map((p) => (
                      <li key={p.id} className="border-t border-gray-100 py-1.5 text-sm text-ink">{p.title}</li>
                    ))}
                  </PanelList>

                  <PanelList title="العلاقات المعرفية" empty="لا توجد روابط كافية حتى الآن لهذه المادة.">
                    {intel.relations.map((r) => (
                      <li key={r.id} className="border-t border-gray-100 py-1.5 text-sm text-ink">
                        {r.sourceType} → {r.relation} → {r.targetType} <span className="text-xs text-muted">({(r.strength * 100).toFixed(0)}%)</span>
                      </li>
                    ))}
                  </PanelList>
                </>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone?: "emerald" | "amber" }) {
  const cls = tone === "emerald" ? "text-emerald-700" : tone === "amber" ? "text-amber-700" : "text-olive";
  return (
    <div className="rounded-md border border-gray-200 bg-ivory p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-1 text-xl font-bold tabular-nums ${cls}`}>{typeof value === "number" ? value.toLocaleString("ar-SA") : value}</p>
    </div>
  );
}

function ActBtn({ children, onClick, href }: { children: React.ReactNode; onClick?: () => void; href?: string }) {
  const cls = "rounded border border-gray-200 bg-surface px-2 py-1 text-xs text-ink hover:bg-gold/10 hover:text-olive";
  if (href) return <a href={href} className={cls}>{children}</a>;
  return <button type="button" onClick={onClick} className={cls}>{children}</button>;
}

function PanelList({ title, empty, children }: { title: string; empty: string; children: React.ReactNode[] }) {
  return (
    <div className="rounded-md border border-gray-100 p-3">
      <div className="text-sm font-semibold text-olive">{title} ({children.length})</div>
      {children.length === 0 ? <p className="mt-1 text-xs text-muted">{empty}</p> : <ul className="mt-1">{children}</ul>}
    </div>
  );
}

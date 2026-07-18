"use client";

import { useState } from "react";

// ── الأنواع الممرّرة من الخادم (ملخّص المانيفست) ──
export type ConsoleSubRole = { id: string; label: string; stance: string };
export type ConsoleTool = {
  id: string; // اسم الأداة كما يفهمه مدخل MCP
  label: string;
  fields: Array<"query" | "articleNumber" | "chapter" | "deadline">;
};
export type AgentConsoleProps = {
  agentId: string;
  displayName: string;
  scope: string[];
  subRoles: ConsoleSubRole[];
  tools: ConsoleTool[];
};

type ApiResult = Record<string, unknown> & { ok?: boolean; status?: string };

const ar = (n: number) => n.toLocaleString("ar-SA");

export function AgentConsole({ agentId, displayName, scope, subRoles, tools }: AgentConsoleProps) {
  const [subRoleId, setSubRoleId] = useState<string>(subRoles[0]?.id ?? "");
  const [toolId, setToolId] = useState<string>(tools[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [articleNumber, setArticleNumber] = useState("");
  const [chapter, setChapter] = useState("");
  const [hy, setHy] = useState(1447);
  const [hm, setHm] = useState(1);
  const [hd, setHd] = useState(1);
  const [period, setPeriod] = useState(30);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ApiResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const tool = tools.find((t) => t.id === toolId) ?? tools[0];
  const need = (f: ConsoleTool["fields"][number]) => tool?.fields.includes(f);

  async function run() {
    if (busy || !tool) return;
    setBusy(true);
    setError(null);
    setResult(null);
    const input: Record<string, unknown> = {};
    if (need("query")) input.query = query.trim();
    if (need("articleNumber")) input.articleNumber = parseInt(articleNumber, 10);
    if (need("chapter")) input.chapter = chapter.trim();
    if (need("deadline")) {
      input.notifyHijri = { year: hy, month: hm, day: hd };
      input.periodDays = period;
    }
    try {
      const res = await fetch(`/api/mcp/${agentId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool: tool.id, subRoleId: subRoleId || undefined, input })
      });
      const data = (await res.json()) as ApiResult;
      if (!res.ok && !data) setError("تعذّر تنفيذ الأداة.");
      else setResult(data);
    } catch {
      setError("انقطع الاتصال أثناء التنفيذ.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div dir="rtl" className="rounded-[var(--r-xl)] border border-line bg-ivory p-5 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-bold text-[var(--petrol)]">وحدة تشغيل {displayName}</h2>
        <span className="rounded-full bg-[var(--surface)] px-2.5 py-0.5 text-[11px] text-[var(--petrol)]">
          النطاق: {scope.map((s) => s.replace(/-/g, " ")).join(" · ")}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {subRoles.length ? (
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--muted)]">الدور (الموقف)</span>
            <select
              value={subRoleId}
              onChange={(e) => setSubRoleId(e.target.value)}
              className="rounded-[var(--r-md)] border border-line bg-ivory px-3 py-2 text-base outline-none focus:border-[var(--copper)]"
            >
              {subRoles.map((sr) => (
                <option key={sr.id} value={sr.id}>{sr.label} — {sr.stance}</option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-[var(--muted)]">الأداة</span>
          <select
            value={toolId}
            onChange={(e) => { setToolId(e.target.value); setResult(null); setError(null); }}
            className="rounded-[var(--r-md)] border border-line bg-ivory px-3 py-2 text-base outline-none focus:border-[var(--copper)]"
          >
            {tools.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </label>
      </div>

      {/* الحقول حسب الأداة */}
      <div className="mt-3 grid gap-3">
        {need("query") ? (
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--muted)]">النصّ</span>
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              rows={2}
              placeholder="اكتب سؤالك أو موضوع البحث ضمن نطاق الوكيل…"
              className="resize-none rounded-[var(--r-md)] border border-line bg-ivory px-3 py-2 text-base leading-7 outline-none focus:border-[var(--copper)]"
            />
          </label>
        ) : null}
        {need("articleNumber") ? (
          <label className="flex max-w-[200px] flex-col gap-1 text-sm">
            <span className="text-[var(--muted)]">رقم المادّة</span>
            <input type="number" value={articleNumber} onChange={(e) => setArticleNumber(e.target.value)}
              className="rounded-[var(--r-md)] border border-line bg-ivory px-3 py-2 text-base outline-none focus:border-[var(--copper)]" />
          </label>
        ) : null}
        {need("chapter") ? (
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-[var(--muted)]">الفصل/الباب</span>
            <input value={chapter} onChange={(e) => setChapter(e.target.value)}
              className="rounded-[var(--r-md)] border border-line bg-ivory px-3 py-2 text-base outline-none focus:border-[var(--copper)]" />
          </label>
        ) : null}
        {need("deadline") ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[["السنة", hy, setHy, 1300, 1600], ["الشهر", hm, setHm, 1, 12], ["اليوم", hd, setHd, 1, 30], ["المدّة (أيام)", period, setPeriod, 0, 100000]].map(
              ([label, val, set, min, max]) => (
                <label key={label as string} className="flex flex-col gap-1 text-sm">
                  <span className="text-[var(--muted)]">{label as string}</span>
                  <input type="number" value={val as number} min={min as number} max={max as number}
                    onChange={(e) => (set as (n: number) => void)(parseInt(e.target.value, 10))}
                    className="rounded-[var(--r-md)] border border-line bg-ivory px-3 py-2 text-base outline-none focus:border-[var(--copper)]" />
                </label>
              )
            )}
          </div>
        ) : null}
      </div>

      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="focus-ring mt-4 rounded-[var(--r-md)] bg-[var(--petrol)] px-6 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
      >
        {busy ? "جارٍ…" : "تشغيل"}
      </button>

      {error ? <p className="mt-4 text-sm text-[var(--ruby)]">{error}</p> : null}
      {result ? <ResultView data={result} /> : null}
    </div>
  );
}

function ResultView({ data }: { data: ApiResult }) {
  // محجوب/مرفوض
  if (data.ok === false && data.status === "blocked") {
    return <Card tone="warn">النمط محظورٌ لهذا الموقف. جرّب دورًا/أداةً أخرى{data.suggestion ? ` (المقترح: ${String(data.suggestion)})` : ""}.</Card>;
  }
  if (data.ok === false && data.status === "rejected") {
    const rejects = Array.isArray(data.rejects) ? (data.rejects as string[]) : [];
    return <Card tone="ruby">رُفض المخرَج بالحرّاس:<ul className="mt-1 list-disc pr-5">{rejects.map((r, i) => <li key={i}>{r}</li>)}</ul></Card>;
  }
  if (data.ok === false) return <Card tone="ruby">{String(data.error ?? "تعذّر التنفيذ.")}</Card>;

  // بحث مؤصَّل
  const answer = data.answer as { title?: string; sections?: { heading: string; body: string }[]; sources?: { system: string; article: string; enforcement: string }[] } | undefined;
  if (answer) {
    return (
      <div className="mt-4 space-y-3">
        <h3 className="font-bold text-[var(--petrol)]">{answer.title}</h3>
        {(answer.sections ?? []).map((s, i) => (
          <div key={i}><p className="text-sm font-semibold text-[var(--ink-80)]">{s.heading}</p><p className="text-sm leading-7 text-[var(--muted)]">{s.body}</p></div>
        ))}
        {answer.sources?.length ? (
          <div className="rounded-[var(--r-lg)] border border-line bg-[var(--surface)] p-3">
            <p className="mb-1 text-xs font-semibold text-[var(--ink-60)]">السند النظاميّ (مؤرَّض، داخل النطاق)</p>
            <ul className="space-y-1">{answer.sources.map((s, i) => (
              <li key={i} className="font-mono-legal text-[12px] text-[var(--petrol)]">• {s.system} — م/{s.article} <span className="text-[var(--muted)]">[{s.enforcement}]</span></li>
            ))}</ul>
          </div>
        ) : null}
      </div>
    );
  }

  // مهلة
  const r = data.result as Record<string, unknown> | undefined;
  if (r && (r.dueHijri || r.dueGregorian)) {
    const dh = r.dueHijri as { year: number; month: number; day: number };
    const dg = r.dueGregorian as { year: number; month: number; day: number };
    return <Card tone="ok">تنتهي المهلة: <b>{dh.year}/{dh.month}/{dh.day}هـ</b> — الموافق {dg.year}-{String(dg.month).padStart(2, "0")}-{String(dg.day).padStart(2, "0")}م<br /><span className="text-xs text-[var(--muted)]">{String(r.note ?? "")}</span></Card>;
  }

  // نتائج أدوات المحرّك (مصفوفات) أو استناد
  if (r) {
    if (typeof r.citation === "string") return <Card tone="ok">{r.citation} <span className="text-xs text-[var(--muted)]">[{String(r.enforcement ?? "")}]</span></Card>;
    if (Array.isArray(r.articles)) return <EngineList title="المواد" note={r.note as string | undefined} items={(r.articles as Record<string, unknown>[]).map((a) => `${a.system} — م/${a.article}${a.title ? " · " + a.title : ""} [${a.enforcement}]`)} />;
    if (Array.isArray(r.principles)) return <EngineList title="المبادئ القضائية" note={r.note as string | undefined} items={(r.principles as Record<string, unknown>[]).map((p) => `${p.title}${p.court ? " · " + p.court : ""}`)} />;
    if (Array.isArray(r.amendments)) return <EngineList title="سلسلة التعديل" note={r.note as string | undefined} items={(r.amendments as Record<string, unknown>[]).map((a) => `نسخة ${a.version} · ${a.changeType}${a.decreeRef ? " · " + a.decreeRef : ""}${a.hijriDate ? " · " + a.hijriDate : ""}`)} />;
    if (typeof r.note === "string") return <Card tone="warn">{r.note}</Card>;
  }

  return <pre className="mt-4 overflow-x-auto rounded-[var(--r-lg)] border border-line bg-[var(--surface)] p-3 text-xs">{JSON.stringify(data, null, 2)}</pre>;
}

function EngineList({ title, items, note }: { title: string; items: string[]; note?: string }) {
  const shown = items.slice(0, 60);
  return (
    <div className="mt-4 rounded-[var(--r-lg)] border border-line bg-[var(--surface)] p-3">
      <p className="mb-1 text-xs font-semibold text-[var(--ink-60)]">{title} ({ar(items.length)})</p>
      {items.length ? (
        <ul className="space-y-1">{shown.map((it, i) => <li key={i} className="font-mono-legal text-[12px] text-[var(--petrol)]">• {it}</li>)}</ul>
      ) : <p className="text-sm text-[var(--muted)]">{note ?? "لا نتائج."}</p>}
      {items.length > shown.length ? <p className="mt-1 text-xs text-[var(--muted)]">… و{ar(items.length - shown.length)} أخرى.</p> : null}
    </div>
  );
}

function Card({ children, tone }: { children: React.ReactNode; tone: "ok" | "warn" | "ruby" }) {
  const cls =
    tone === "ok" ? "border-line bg-[var(--surface)] text-[var(--petrol)]"
      : tone === "warn" ? "border-amber-300 bg-amber-50 text-amber-800"
        : "border-[rgba(140,34,51,0.3)] bg-[var(--ruby-soft)] text-[var(--ruby)]";
  return <div className={`mt-4 rounded-[var(--r-lg)] border p-4 text-sm leading-7 ${cls}`}>{children}</div>;
}

"use client";

// لوحة الأعمال المقترحة (§21) — تقترح أعمالًا بحسب المرحلة، ولا تنفّذ تلقائيًّا.
// المتاح حيًّا: JS-001 (ملخّص مؤصَّل عبر النموذج)، JS-009 (مدد حتميّة)، JS-010 (مصفوفة إثبات حتميّة).
// الحتميّة مستقلّة عن النموذج وتُبنى من بيانات القضية. بقيّة الأعمال على خارطة الطريق بشفافيّة.
import { useState } from "react";
import { JaIcon } from "./icons";
import { SERVICES } from "@/lib/modules/judicial-assistant/catalog";
import { runnerFor } from "@/lib/modules/judicial-assistant/routing";
import { AnswerRenderer } from "@/components/AnswerRenderer";
import type {
  DeterministicActionResult, ExecutiveSummaryResult, GroundedWorkResult, JudgmentDraftResult, JudicialStudyResult, SuggestedAction,
} from "@/lib/modules/judicial-assistant/types";
import { FACT_STATUS_LABEL, formatDate } from "@/lib/modules/judicial-assistant/labels";

type StreamCite = { articleId?: string; lawName: string; articleNumber: number; quote: string };
type StreamData = { serviceId: string; title: string; body: string; citations: StreamCite[]; notice: string; blocked: boolean; done: boolean };

type Panel =
  | { kind: "summary"; data: ExecutiveSummaryResult }
  | { kind: "deterministic"; data: DeterministicActionResult }
  | { kind: "draft"; data: JudgmentDraftResult }
  | { kind: "study"; data: JudicialStudyResult }
  | { kind: "work"; data: GroundedWorkResult }
  | { kind: "stream"; data: StreamData };

/** يحوّل نتيجة أيّ خدمةٍ إلى نصٍّ للنسخ/التصدير (عرضٌ موحَّد للمخرَج). */
function panelToText(panel: Panel): string {
  const cites = (c: Array<{ lawName: string; articleNumber: number; quote: string }>) =>
    c.length ? "\n\nالأساس النظاميّ:\n" + c.map((x) => `- ${x.lawName}، المادة ${x.articleNumber}: ${x.quote}`).join("\n") : "";
  if (panel.kind === "stream") return `${panel.data.title}\n\n${panel.data.body}` + cites(panel.data.citations);
  if (panel.kind === "summary") return panel.data.summary + cites(panel.data.citations);
  if (panel.kind === "study") return panel.data.body + cites(panel.data.citations);
  if (panel.kind === "work") return `${panel.data.title}\n\n${panel.data.body}` + cites(panel.data.citations);
  if (panel.kind === "draft") return panel.data.sections.map((s) => `## ${s.title}\n${s.body}`).join("\n\n") + cites(panel.data.citations);
  const d = panel.data;
  if (d.serviceId === "JS-004") return "الخطّ الزمنيّ:\n" + d.events.map((e) => `- ${e.date}: ${e.label} — ${e.detail}`).join("\n");
  if (d.serviceId === "JS-009") return "المدد:\n" + d.computations.map((c) => `- ${c.label}: ${c.dueDate} (${c.explanation})`).join("\n");
  if (d.serviceId === "JS-010") return "مصفوفة الإثبات:\n" + d.rows.map((r) => `- ${r.fact} | ${r.status} | ${r.tentative}`).join("\n");
  return `${d.title}:\n` + d.items.map((it) => `- [${it.outcome}] ${it.question} — ${it.note}`).join("\n");
}

const PANEL_SERVICE: Record<string, string> = { summary: "JS-001", study: "JS-013", draft: "JS-018" };

// قراءةٌ آمنة للاستجابة: لا نستدعي res.json() مباشرةً (يرمي «The string did not match the
// expected pattern» في Safari عند جسمٍ فارغٍ/غير JSON مثل مهلة 504) — بل نقرأ نصًّا ونحلّله بأمان.
async function readJson(res: Response): Promise<Record<string, unknown>> {
  const raw = await res.text().catch(() => "");
  let data: Record<string, unknown> = {};
  if (raw) { try { data = JSON.parse(raw); } catch { /* ليست JSON */ } }
  if (!res.ok) {
    if (data.message) throw new Error(data.message as string);
    // فشلٌ غير مُعلَّل (لا رسالة من التطبيق) ⇒ رفضٌ من حافة Vercel لا من الكود. نكشف سببه الحقيقيّ:
    // ترويسة x-vercel-error (مثل NOT_FOUND / FUNCTION_INVOCATION_FAILED / DEPLOYMENT_NOT_FOUND)
    // أو مقتطفٌ من الجسم — كي يظهر السبب في الواجهة مباشرةً بلا أدوات المطوّر.
    const vercel = res.headers.get("x-vercel-error") || res.headers.get("x-vercel-error-code");
    const ctype = res.headers.get("content-type") || "";
    const snippet = !ctype.includes("json") && raw ? raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 90) : "";
    const hint = vercel ? ` · ${vercel}` : snippet ? ` · ${snippet}` : "";
    throw new Error(`تعذّر التشغيل (رمز ${res.status}${hint}).`);
  }
  return data;
}

export function CaseActions({ caseId, actions }: { caseId: string; actions: SuggestedAction[] }) {
  const [running, setRunning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [approved, setApproved] = useState(false);
  const [showAll, setShowAll] = useState(false);

  // requestId للمخرَج الحاليّ (للتوثيق في سجلّ الاعتماد) إن توفّر.
  function panelRequestId(p: Panel): string | undefined {
    if (p.kind === "summary" || p.kind === "study" || p.kind === "work" || p.kind === "draft") return (p.data as { requestId?: string }).requestId;
    return undefined;
  }

  async function approve() {
    if (!activeId || !panel) return;
    try {
      const res = await fetch("/api/judicial-assistant/approve", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId, serviceId: activeId, requestId: panelRequestId(panel) }),
      });
      if (res.ok) setApproved(true);
    } catch { /* تجاهل */ }
  }

  async function run(serviceId: string) {
    const runner = runnerFor(serviceId);
    // JS-005 استخلاص الخريطة له لوحته المخصّصة (MapExtractor) — انتقل إليها بدل مسار الأعمال.
    if (runner === "map") {
      document.getElementById("ja-map-extract")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setRunning(serviceId);
    setError(null);
    setActiveId(serviceId);
    setCopied(false);
    setApproved(false);
    try {
      // الخدمات النموذجيّة تُبَثّ حيًّا (كتابةٌ تدريجيّة كـ«اسأل حكيم») عبر مسارٍ متداخل — بلا 504.
      if (runner === "summary" || runner === "draft" || runner === "study" || runner === "work") {
        const title = SERVICES.find((s) => s.id === serviceId)?.title ?? serviceId;
        setPanel({ kind: "stream", data: { serviceId, title, body: "", citations: [], notice: "", blocked: false, done: false } });
        const res = await fetch(`/api/judicial-assistant/cases/${caseId}/run/stream`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ serviceId, ...(runner === "study" ? { depth: "medium" } : {}) }),
        });
        if (!res.ok || !res.body) { await readJson(res); return; }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        let acc = "";
        let lastPaint = 0; // خنقٌ خفيف: نُعيد الرسم كلّ ~120ms لا مع كلّ جزء (تفادي ثقل إعادة تحليل Markdown).
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            const t = line.trim();
            if (!t) continue;
            let ev: { type?: string; text?: string; citations?: StreamCite[]; notice?: string; blocked?: boolean };
            try { ev = JSON.parse(t); } catch { continue; }
            if (ev.type === "delta" && ev.text) {
              acc += ev.text;
              const now = Date.now();
              if (now - lastPaint > 120) {
                lastPaint = now;
                setPanel({ kind: "stream", data: { serviceId, title, body: acc, citations: [], notice: "", blocked: false, done: false } });
              }
            } else if (ev.type === "done") {
              setPanel({ kind: "stream", data: { serviceId, title, body: acc, citations: ev.citations ?? [], notice: ev.notice ?? "", blocked: ev.blocked ?? false, done: true } });
            }
          }
        }
      } else if (runner === "export") {
        const res = await fetch(`/api/judicial-assistant/cases/${caseId}/export`);
        if (!res.ok) { await readJson(res); }
        const text = await res.text();
        const url = URL.createObjectURL(new Blob([text], { type: "text/markdown;charset=utf-8" }));
        const a = document.createElement("a"); a.href = url; a.download = `case-${caseId}.md`; a.click();
        URL.revokeObjectURL(url);
      } else {
        const res = await fetch("/api/judicial-assistant/action", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ caseId, serviceId }),
        });
        setPanel({ kind: "deterministic", data: (await readJson(res)) as unknown as DeterministicActionResult });
      }
    } catch (err) {
      const m = err instanceof Error ? err.message : "";
      const network = /load failed|failed to fetch|networkerror|aborted/i.test(m);
      setError(network ? "تعذّر إكمال الطلب — قد تكون العمليّة طويلة أو الاتصال ضعيفًا. أعد المحاولة." : m || "تعذّر التشغيل.");
    } finally {
      setRunning(null);
    }
  }

  return (
    <div className="ja-actions">
      {actions.length === 0 ? (
        <p className="ja-actions__empty">
          <JaIcon name="documents" size={15} /> لا أعمالَ مقترحةً بعد — أضِف مرفقًا أوّلًا لتُبنى الاقتراحات على مادّة قضيتك الحيّة، لا على قوالبَ عامّة. يمكنك أيضًا فتح «كلّ الأعمال» أدناه يدويًّا.
        </p>
      ) : null}
      <div className="ja-actions__grid">
        {actions.map((a) => (
          <div key={a.serviceId} className={`ja-action ${a.available ? "" : "ja-action--soon"}`}>
            <div className="ja-action__head">
              <span className="ja-action__ic"><JaIcon name={a.iconKey} size={18} /></span>
              <div className="ja-action__meta">
                <h4>{a.title} <span className="ja-action__id">{a.serviceId}</span></h4>
                <p>{a.reason}</p>
              </div>
            </div>
            {a.available ? (
              <button type="button" className="btn btn-gold ja-action__btn" onClick={() => void run(a.serviceId)} disabled={running !== null}>
                {running === a.serviceId ? "جارٍ التشغيل…" : "تشغيل"}
              </button>
            ) : (
              <span className="ja-action__soon">على خارطة الطريق</span>
            )}
          </div>
        ))}
      </div>

      <div className="ja-allworks">
        <button type="button" className="ja-textbtn" onClick={() => setShowAll((v) => !v)}>
          {showAll ? "إخفاء كلّ الأعمال ▲" : `كلّ الأعمال (${SERVICES.filter((s) => s.available).length}) ▾`}
        </button>
        {showAll ? (
          <div className="ja-allworks__grid">
            {SERVICES.filter((s) => s.available).map((s) => (
              <button key={s.id} type="button" className="ja-workchip" onClick={() => void run(s.id)} disabled={running !== null} title={s.title}>
                <JaIcon name={s.iconKey} size={15} />
                <span>{s.title}</span>
                <span className="ja-action__id">{running === s.id ? "…" : s.id}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {error ? <div className="ja-alert ja-alert--danger">{error}</div> : null}

      {/* لوحة تحكّم النتيجة الموحَّدة — لكلّ خدمة: نسخ · تصدير · إعادة تشغيل · إغلاق */}
      {panel ? (
        <div className="ja-result">
          <div className="ja-result__bar">
            <span className="ja-result__id">نتيجة {activeId ?? (panel.kind === "deterministic" ? panel.data.serviceId : PANEL_SERVICE[panel.kind])}</span>
            <div className="ja-result__actions">
              {approved
                ? <span className="ja-result__approved">✓ معتمَدٌ من القاضي</span>
                : <button type="button" className="ja-result__approve" onClick={() => void approve()}>اعتمد المسودّة</button>}
              <button type="button" className="ja-textbtn" onClick={() => { navigator.clipboard?.writeText(panelToText(panel)).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => undefined); }}>{copied ? "نُسخ ✓" : "نسخ"}</button>
              <button type="button" className="ja-textbtn" onClick={() => {
                const url = URL.createObjectURL(new Blob([panelToText(panel)], { type: "text/markdown;charset=utf-8" }));
                const a = document.createElement("a"); a.href = url; a.download = `${activeId ?? "result"}.md`; a.click(); URL.revokeObjectURL(url);
              }}>تصدير</button>
              {activeId ? <button type="button" className="ja-textbtn" onClick={() => void run(activeId)} disabled={running !== null}>إعادة التشغيل</button> : null}
              <button type="button" className="ja-textbtn ja-textbtn--danger" onClick={() => setPanel(null)}>إغلاق</button>
            </div>
          </div>

      {panel?.kind === "stream" ? <StreamView data={panel.data} /> : null}
      {panel?.kind === "summary" ? <SummaryView data={panel.data} /> : null}
      {panel?.kind === "study" ? <StudyView data={panel.data} /> : null}
      {panel?.kind === "work" ? <WorkView data={panel.data} /> : null}
      {panel?.kind === "draft" ? <DraftView data={panel.data} /> : null}
      {panel?.kind === "deterministic" && panel.data.serviceId === "JS-004" ? <TimelineView data={panel.data} /> : null}
      {panel?.kind === "deterministic" && panel.data.serviceId === "JS-009" ? <DeadlineView data={panel.data} /> : null}
      {panel?.kind === "deterministic" && panel.data.serviceId === "JS-010" ? <EvidenceView data={panel.data} /> : null}
      {panel?.kind === "deterministic" && ["JS-006", "JS-007", "JS-008", "JS-019", "JS-020", "JS-024"].includes(panel.data.serviceId) ? <ChecklistView data={panel.data as import("@/lib/modules/judicial-assistant/types").ChecklistResult} /> : null}
        </div>
      ) : null}
    </div>
  );
}

function WorkView({ data }: { data: GroundedWorkResult }) {
  return (
    <div className="ja-summary">
      <div className={`ja-summary__banner ${data.blocked ? "ja-summary__banner--blocked" : ""}`}>
        <JaIcon name={data.blocked ? "security" : "quality"} size={16} /><span>{data.notice}</span>
      </div>
      <div className="ja-summary__head">
        <h3>{data.title} <span className="ja-action__id">{data.serviceId}</span></h3>
        <span className="ja-summary__stamp">مسودّة — تحتاج تثبيتًا</span>
      </div>
      <div className="ja-summary__body">
        <AnswerRenderer content={data.body} basis={data.citations.map((c) => ({ articleNumber: c.articleNumber, systemName: c.lawName }))} />
      </div>
      {data.citations.length > 0 ? (
        <div className="ja-sources">
          <h4><JaIcon name="sources" size={15} /> الأساس النظاميّ ({data.citations.length})</h4>
          <ul>{data.citations.map((c, i) => (
            <li key={c.articleId + i}><span className="ja-src__law">{c.lawName} — المادة {c.articleNumber}</span><span className="ja-src__quote">{c.quote}</span></li>
          ))}</ul>
        </div>
      ) : null}
      {data.precedents.length > 0 ? (
        <div className="ja-sources">
          <h4><JaIcon name="appeal" size={15} /> سوابق من النواة ({data.precedents.length})</h4>
          <ul>{data.precedents.map((p) => (
            <li key={p.id}><a className="ja-src__law" href={`/dashboard/legal-core/judgments/${p.id}`}>{p.title}{p.court ? ` — ${p.court}` : ""}</a><span className="ja-src__quote">{p.snippet}…</span></li>
          ))}</ul>
        </div>
      ) : null}
    </div>
  );
}

function StudyView({ data }: { data: JudicialStudyResult }) {
  const DEPTH: Record<string, string> = { short: "مختصرة", medium: "متوسّطة", extended: "موسّعة" };
  return (
    <div className="ja-summary">
      <div className={`ja-summary__banner ${data.blocked ? "ja-summary__banner--blocked" : ""}`}>
        <JaIcon name={data.blocked ? "security" : "study"} size={16} /><span>{data.notice}</span>
      </div>
      <div className="ja-summary__head">
        <h3>الدراسة القضائيّة <span className="ja-action__id">JS-013</span></h3>
        <span className="ja-summary__stamp">عمق: {DEPTH[data.depth] ?? data.depth} — مسودّة</span>
      </div>
      <div className="ja-summary__body">
        <AnswerRenderer content={data.body} basis={data.citations.map((c) => ({ articleNumber: c.articleNumber, systemName: c.lawName }))} />
      </div>
      {data.citations.length > 0 ? (
        <div className="ja-sources">
          <h4><JaIcon name="sources" size={15} /> الأساس النظاميّ ({data.citations.length})</h4>
          <ul>{data.citations.map((c, i) => (
            <li key={c.articleId + i}><span className="ja-src__law">{c.lawName} — المادة {c.articleNumber}</span><span className="ja-src__quote">{c.quote}</span></li>
          ))}</ul>
        </div>
      ) : null}
      {data.precedents.length > 0 ? (
        <div className="ja-sources">
          <h4><JaIcon name="appeal" size={15} /> سوابق من النواة ({data.precedents.length})</h4>
          <ul>{data.precedents.map((p) => (
            <li key={p.id}><a className="ja-src__law" href={`/dashboard/legal-core/judgments/${p.id}`}>{p.title}{p.court ? ` — ${p.court}` : ""}</a><span className="ja-src__quote">{p.snippet}…</span></li>
          ))}</ul>
        </div>
      ) : null}
    </div>
  );
}

function DraftView({ data }: { data: JudgmentDraftResult }) {
  return (
    <div className="ja-summary">
      <div className={`ja-summary__banner ${data.blocked ? "ja-summary__banner--blocked" : ""}`}>
        <JaIcon name="judgment" size={16} />
        <span>{data.notice}</span>
      </div>
      <div className="ja-summary__head">
        <h3>مشروع الحكم <span className="ja-action__id">JS-018</span></h3>
        <span className="ja-summary__stamp">مسودّة — تحتاج تثبيتًا بشريًّا</span>
      </div>

      <div className="ja-draft">
        {data.sections.map((s) => (
          <section key={s.key} className="ja-draft__sec">
            <h4>{s.title}{s.generated ? <span className="ja-badge ja-badge--warning ja-draft__gen">مُولَّد — دقّقه</span> : <span className="ja-badge ja-badge--info ja-draft__gen">من الملفّ</span>}</h4>
            <AnswerRenderer content={s.body} basis={data.citations.map((c) => ({ articleNumber: c.articleNumber, systemName: c.lawName }))} />
          </section>
        ))}
      </div>

      {data.citations.length > 0 ? (
        <div className="ja-sources">
          <h4><JaIcon name="sources" size={15} /> الأساس النظاميّ للتسبيب ({data.citations.length})</h4>
          <ul>
            {data.citations.map((c, i) => (
              <li key={c.articleId + i}>
                <span className="ja-src__law">{c.lawName} — المادة {c.articleNumber}</span>
                <span className="ja-src__quote">{c.quote}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {data.precedents.length > 0 ? (
        <div className="ja-sources">
          <h4><JaIcon name="appeal" size={15} /> سوابق من النواة ({data.precedents.length})</h4>
          <ul>
            {data.precedents.map((p) => (
              <li key={p.id}>
                <a className="ja-src__law" href={`/dashboard/legal-core/judgments/${p.id}`}>{p.title}{p.court ? ` — ${p.court}` : ""}{p.reviewed ? "" : " (غير مُراجَع)"}</a>
                <span className="ja-src__quote">{p.snippet}…</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function StreamView({ data }: { data: StreamData }) {
  return (
    <div className="ja-summary">
      <div className={`ja-summary__banner ${data.blocked ? "ja-summary__banner--blocked" : ""}`}>
        <JaIcon name={data.blocked ? "security" : "quality"} size={16} />
        <span>{data.notice || (data.done ? "اكتمل." : "يجري التوليد الحيّ…")}</span>
      </div>
      <div className="ja-summary__head">
        <h3>{data.title} <span className="ja-action__id">{data.serviceId}</span></h3>
        <span className="ja-summary__stamp">{data.done ? "مسودّة — تحتاج تثبيتًا" : "يكتب الآن…"}</span>
      </div>
      <div className="ja-summary__body">
        {data.body
          ? <AnswerRenderer content={data.body} basis={data.citations.map((c) => ({ articleNumber: c.articleNumber, systemName: c.lawName }))} />
          : <p className="ja-sources__empty">…</p>}
        {!data.done ? <span className="ja-stream-caret" aria-hidden>▍</span> : null}
      </div>
      {data.done && data.citations.length > 0 ? (
        <div className="ja-sources">
          <h4><JaIcon name="sources" size={15} /> الأساس النظاميّ ({data.citations.length})</h4>
          <ul>{data.citations.map((c, i) => (
            <li key={(c.articleId ?? "") + i}><span className="ja-src__law">{c.lawName} — المادة {c.articleNumber}</span><span className="ja-src__quote">{c.quote}</span></li>
          ))}</ul>
        </div>
      ) : null}
    </div>
  );
}

function SummaryView({ data }: { data: ExecutiveSummaryResult }) {
  return (
    <div className="ja-summary">
      <div className={`ja-summary__banner ${data.blocked ? "ja-summary__banner--blocked" : ""}`}>
        <JaIcon name={data.blocked ? "security" : "quality"} size={16} />
        <span>{data.notice}</span>
      </div>
      <div className="ja-summary__head">
        <h3>الملخّص التنفيذيّ <span className="ja-action__id">JS-001</span></h3>
        <span className="ja-summary__stamp">{data.generatedAtLabel}</span>
      </div>
      <div className="ja-summary__body">
        <AnswerRenderer content={data.summary} basis={data.citations.map((c) => ({ articleNumber: c.articleNumber, systemName: c.lawName }))} />
      </div>
      {data.citations.length > 0 ? (
        <div className="ja-sources">
          <h4><JaIcon name="sources" size={15} /> الأساس النظاميّ ({data.citations.length})</h4>
          <ul>
            {data.citations.map((c, i) => (
              <li key={c.articleId + i}>
                <span className="ja-src__law">{c.lawName} — المادة {c.articleNumber}</span>
                <span className="ja-src__quote">{c.quote}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="ja-sources__empty">لا استشهاد نظاميّ مؤصَّل — لم يُبنَ تأصيلٌ من الذاكرة.</p>
      )}
    </div>
  );
}

function TimelineView({ data }: { data: import("@/lib/modules/judicial-assistant/types").TimelineResult }) {
  return (
    <div className="ja-summary">
      <div className="ja-summary__banner">
        <JaIcon name="procedure" size={16} />
        <span>محرّكٌ حتميّ — خطٌّ زمنيّ مرتَّب من أحداث القضية.</span>
      </div>
      <div className="ja-summary__head">
        <h3>الخطّ الزمنيّ <span className="ja-action__id">JS-004</span></h3>
      </div>
      <div className="ja-detbody">
        <ol className="ja-tl">
          {data.events.map((e, i) => (
            <li key={i} className={`ja-tl__item ja-tl__item--${e.kind}`}>
              <span className="ja-tl__date">{formatDate(e.date)}</span>
              <div className="ja-tl__body">
                <span className="ja-tl__label">{e.label}{e.flag ? <span className="ja-badge ja-badge--warning ja-tl__flag">{e.flag}</span> : null}</span>
                <span className="ja-tl__detail">{e.detail}</span>
              </div>
            </li>
          ))}
        </ol>
      </div>
      {data.conflicts.length > 0 ? (
        <div className="ja-sources">
          <h4><JaIcon name="quality" size={15} /> تعارضاتٌ للمراجعة ({data.conflicts.length})</h4>
          <ul>{data.conflicts.map((c, i) => <li key={i}><span className="ja-src__quote">{c}</span></li>)}</ul>
        </div>
      ) : null}
      <p className="ja-det__disc">{data.disclaimer}</p>
    </div>
  );
}

function DeadlineView({ data }: { data: import("@/lib/modules/judicial-assistant/types").DeadlineResult }) {
  return (
    <div className="ja-summary">
      <div className="ja-summary__banner">
        <JaIcon name="deadline" size={16} />
        <span>محرّكٌ حتميّ — الحساب مستقلٌّ عن النموذج ويشرح خطواته.</span>
      </div>
      <div className="ja-summary__head">
        <h3>حساب المدد <span className="ja-action__id">JS-009</span></h3>
      </div>
      <div className="ja-detbody">
        {data.computations.length === 0 ? (
          <p className="ja-sources__empty">لا مدداً قابلةً للحساب من الأحداث الموثّقة الحاليّة (تعطّلٌ آمن عند نقص الحدث المرجعيّ).</p>
        ) : (
          <ul className="ja-det">
            {data.computations.map((c) => (
              <li key={c.ruleId} className="ja-det__row">
                <div className="ja-det__head">
                  <span className="ja-det__label">{c.label}</span>
                  <span className="ja-det__due">{formatDate(c.dueDate)}</span>
                </div>
                <div className="ja-det__calc">{c.explanation}</div>
                <div className="ja-det__basis"><span className="ja-badge ja-badge--warning">نموذجيّة</span> {c.basisNote}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="ja-det__disc">{data.disclaimer}</p>
    </div>
  );
}

function ChecklistView({ data }: { data: import("@/lib/modules/judicial-assistant/types").ChecklistResult }) {
  const OUTCOME: Record<string, { label: string; tone: string }> = {
    review: { label: "مراجعة", tone: "info" }, missing: { label: "ناقص", tone: "warning" }, flag: { label: "تنبيه", tone: "danger" },
  };
  return (
    <div className="ja-summary">
      <div className="ja-summary__banner"><JaIcon name={data.serviceId === "JS-006" ? "jurisdiction" : "admissibility"} size={16} /><span>محرّكٌ حتميّ — قائمة مراجعةٍ لا حكم.</span></div>
      <div className="ja-summary__head"><h3>{data.title} <span className="ja-action__id">{data.serviceId}</span></h3></div>
      <div className="ja-detbody">
        <ul className="ja-check">
          {data.items.map((it) => (
            <li key={it.key} className="ja-check__row">
              <span className={`ja-badge ja-badge--${OUTCOME[it.outcome]?.tone ?? "info"}`}>{OUTCOME[it.outcome]?.label ?? it.outcome}</span>
              <div><div className="ja-check__q">{it.question}</div><div className="ja-check__note">{it.note}</div></div>
            </li>
          ))}
        </ul>
      </div>
      {data.missing.length > 0 ? (
        <div className="ja-sources"><h4><JaIcon name="quality" size={15} /> بياناتٌ ناقصة ({data.missing.length})</h4>
          <ul>{data.missing.map((m, i) => <li key={i}><span className="ja-src__quote">{m}</span></li>)}</ul>
        </div>
      ) : null}
      <p className="ja-det__disc">{data.disclaimer}</p>
    </div>
  );
}

function EvidenceView({ data }: { data: import("@/lib/modules/judicial-assistant/types").EvidenceMatrixResult }) {
  return (
    <div className="ja-summary">
      <div className="ja-summary__banner">
        <JaIcon name="evidence" size={16} />
        <span>محرّكٌ حتميّ — نتيجةٌ أوليّة لا تقرّر ثبوتًا نهائيًّا.</span>
      </div>
      <div className="ja-summary__head">
        <h3>مصفوفة الإثبات <span className="ja-action__id">JS-010</span></h3>
      </div>
      <div className="ja-tablewrap">
        <table className="ja-table">
          <thead>
            <tr><th>الواقعة</th><th>الحالة</th><th>العبء</th><th>الدليل</th><th>النتيجة الأوليّة</th></tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <tr key={r.factId}>
                <td>{r.fact}<div className="ja-muted">{r.note}</div></td>
                <td>{FACT_STATUS_LABEL[r.status]}</td>
                <td>{r.burdenParty}</td>
                <td>{r.hasEvidence ? "مرتبط" : "—"}</td>
                <td>{r.tentative}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.gaps.length > 0 ? (
        <div className="ja-sources">
          <h4><JaIcon name="quality" size={15} /> وقائع بلا دليل ({data.gaps.length})</h4>
          <ul>{data.gaps.map((g, i) => <li key={i}><span className="ja-src__quote">{g}</span></li>)}</ul>
        </div>
      ) : null}
      <p className="ja-det__disc">{data.disclaimer}</p>
    </div>
  );
}

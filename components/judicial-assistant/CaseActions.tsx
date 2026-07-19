"use client";

// لوحة الأعمال المقترحة (§21) — تقترح أعمالًا بحسب المرحلة، ولا تنفّذ تلقائيًّا.
// المتاح حيًّا: JS-001 (ملخّص مؤصَّل عبر النموذج)، JS-009 (مدد حتميّة)، JS-010 (مصفوفة إثبات حتميّة).
// الحتميّة مستقلّة عن النموذج وتُبنى من بيانات القضية. بقيّة الأعمال على خارطة الطريق بشفافيّة.
import { useState } from "react";
import { JaIcon } from "./icons";
import type {
  DeterministicActionResult, ExecutiveSummaryResult, JudgmentDraftResult, JudicialStudyResult, SuggestedAction,
} from "@/lib/modules/judicial-assistant/types";
import { FACT_STATUS_LABEL, formatDate } from "@/lib/modules/judicial-assistant/labels";

type Panel =
  | { kind: "summary"; data: ExecutiveSummaryResult }
  | { kind: "deterministic"; data: DeterministicActionResult }
  | { kind: "draft"; data: JudgmentDraftResult }
  | { kind: "study"; data: JudicialStudyResult };

export function CaseActions({ caseId, actions }: { caseId: string; actions: SuggestedAction[] }) {
  const [running, setRunning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel | null>(null);

  async function run(serviceId: string) {
    setRunning(serviceId);
    setError(null);
    try {
      if (serviceId === "JS-001") {
        const res = await fetch("/api/judicial-assistant/summary", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ caseId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || "تعذّر التشغيل.");
        setPanel({ kind: "summary", data });
      } else if (serviceId === "JS-018") {
        const res = await fetch("/api/judicial-assistant/draft", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ caseId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || "تعذّر التشغيل.");
        setPanel({ kind: "draft", data });
      } else if (serviceId === "JS-013") {
        const res = await fetch("/api/judicial-assistant/study", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ caseId, depth: "medium" }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || "تعذّر التشغيل.");
        setPanel({ kind: "study", data });
      } else {
        const res = await fetch("/api/judicial-assistant/action", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ caseId, serviceId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || "تعذّر التشغيل.");
        setPanel({ kind: "deterministic", data });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر التشغيل.");
    } finally {
      setRunning(null);
    }
  }

  return (
    <div className="ja-actions">
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

      {error ? <div className="ja-alert ja-alert--danger">{error}</div> : null}

      {panel?.kind === "summary" ? <SummaryView data={panel.data} /> : null}
      {panel?.kind === "study" ? <StudyView data={panel.data} /> : null}
      {panel?.kind === "draft" ? <DraftView data={panel.data} /> : null}
      {panel?.kind === "deterministic" && panel.data.serviceId === "JS-004" ? <TimelineView data={panel.data} /> : null}
      {panel?.kind === "deterministic" && panel.data.serviceId === "JS-009" ? <DeadlineView data={panel.data} /> : null}
      {panel?.kind === "deterministic" && panel.data.serviceId === "JS-010" ? <EvidenceView data={panel.data} /> : null}
      {panel?.kind === "deterministic" && (panel.data.serviceId === "JS-006" || panel.data.serviceId === "JS-007") ? <ChecklistView data={panel.data} /> : null}
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
        {data.body.split("\n").filter(Boolean).map((line, i) => <p key={i}>{line}</p>)}
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
            {s.body.split("\n").filter(Boolean).map((line, i) => <p key={i}>{line}</p>)}
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
        {data.summary.split("\n").filter(Boolean).map((line, i) => <p key={i}>{line}</p>)}
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

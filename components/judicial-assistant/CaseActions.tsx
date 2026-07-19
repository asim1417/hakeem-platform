"use client";

// لوحة الأعمال المقترحة (§21) — تقترح أعمالًا بحسب المرحلة، ولا تنفّذ تلقائيًّا.
// JS-001 (الملخّص التنفيذيّ) متاحٌ حيًّا: يستدعي المسار المؤصَّل ويعرض النتيجة باستشهاداتٍ قابلة للفتح.
// بقيّة الأعمال تُعرض كمقترحاتٍ على خارطة الطريق (غير قابلة للتشغيل بعد) — بشفافيّة.
import { useState } from "react";
import { JaIcon } from "./icons";
import type { ExecutiveSummaryResult, SuggestedAction } from "@/lib/modules/judicial-assistant/types";

type SummaryState = { loading: boolean; error?: string; result?: ExecutiveSummaryResult };

export function CaseActions({ caseId, actions }: { caseId: string; actions: SuggestedAction[] }) {
  const [summary, setSummary] = useState<SummaryState>({ loading: false });

  async function runSummary() {
    setSummary({ loading: true });
    try {
      const res = await fetch("/api/judicial-assistant/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "تعذّر إنشاء الملخّص.");
      setSummary({ loading: false, result: data as ExecutiveSummaryResult });
    } catch (err) {
      setSummary({ loading: false, error: err instanceof Error ? err.message : "تعذّر إنشاء الملخّص." });
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
            {a.available && a.serviceId === "JS-001" ? (
              <button type="button" className="btn btn-gold ja-action__btn" onClick={() => void runSummary()} disabled={summary.loading}>
                {summary.loading ? "جارٍ التأصيل…" : "تشغيل"}
              </button>
            ) : (
              <span className="ja-action__soon">على خارطة الطريق</span>
            )}
          </div>
        ))}
      </div>

      {summary.error ? <div className="ja-alert ja-alert--danger">{summary.error}</div> : null}

      {summary.result ? (
        <div className="ja-summary">
          <div className={`ja-summary__banner ${summary.result.blocked ? "ja-summary__banner--blocked" : ""}`}>
            <JaIcon name={summary.result.blocked ? "security" : "quality"} size={16} />
            <span>{summary.result.notice}</span>
          </div>

          <div className="ja-summary__head">
            <h3>الملخّص التنفيذيّ <span className="ja-action__id">JS-001</span></h3>
            <span className="ja-summary__stamp">{summary.result.generatedAtLabel}</span>
          </div>

          <div className="ja-summary__body">
            {summary.result.summary.split("\n").filter(Boolean).map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>

          {summary.result.citations.length > 0 ? (
            <div className="ja-sources">
              <h4><JaIcon name="sources" size={15} /> الأساس النظاميّ ({summary.result.citations.length})</h4>
              <ul>
                {summary.result.citations.map((c, i) => (
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
      ) : null}
    </div>
  );
}

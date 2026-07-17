"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, ClipboardCopy, FileText, Loader2, RefreshCcw, ShieldAlert, XCircle } from "lucide-react";
import { LegalCopyButton } from "@/components/LegalCopyButton";

type CourtPosition = "basis" | "dispute" | "procedural" | "general_reference" | "unresolved";

type CitationResult = {
  rawText: string;
  systemName: string | null;
  articleNumber: number | null;
  resolvedArticleId: string | null;
  resolvedArticleText: string | null;
  confidence: number;
  section: string;
  courtPosition: CourtPosition;
};

type AnalysisResponse = {
  inputLength: number;
  detectedCount: number;
  resolvedCount: number;
  unresolvedCount: number;
  citations: CitationResult[];
  reverseIndex: Array<{ articleId: string; systemName: string; articleNumber: number; references: number }>;
  message?: string;
};

const sampleJudgment = `الوقائع:
ذكر المدعي أن المدعى عليها أخلت بالتزاماتها التعاقدية، وطلب إلزامها بالتعويض.

الأسباب:
وحيث إن المادة 164 من نظام المعاملات المدنية تقضي بمسؤولية من تسبب في ضرر، وحيث نصت المادة السابعة والخمسون من نظام الإثبات على أحكام متعلقة بعبء الإثبات، فإن الدائرة تنظر في مدى قيام البينة.

المنطوق:
حكمت المحكمة بإلزام المدعى عليها بالتعويض استنادًا إلى المادة 164 من نظام المعاملات المدنية.`;

const positionLabels: Record<CourtPosition, { label: string; className: string }> = {
  basis: { label: "أساس الحكم", className: "border-[rgba(26,92,65,.25)] bg-[var(--emerald-soft)] text-[var(--emerald)]" },
  dispute: { label: "قول خصوم", className: "border-[var(--gold-border)] bg-[var(--gold-ghost)] text-[var(--navy)]" },
  procedural: { label: "إجرائي", className: "border-[rgba(184,114,26,.25)] bg-[var(--amber-soft)] text-[var(--amber)]" },
  general_reference: { label: "مرجع عام", className: "border-[var(--ink-08)] bg-ivory/70 text-[var(--ink-70)]" },
  unresolved: { label: "غير محلول", className: "border-[rgba(140,34,51,.25)] bg-[var(--ruby-soft)] text-[var(--ruby)]" }
};

export function JudgmentCitationCapture() {
  const [judgmentText, setJudgmentText] = useState("");
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [decisions, setDecisions] = useState<Record<number, "approved" | "rejected" | "manual">>({});

  const decisionStats = useMemo(() => {
    const values = Object.values(decisions);
    return {
      approved: values.filter((value) => value === "approved").length,
      rejected: values.filter((value) => value === "rejected").length
    };
  }, [decisions]);

  async function analyze() {
    setLoading(true);
    setError("");
    setAnalysis(null);
    setDecisions({});
    try {
      const response = await fetch("/api/legal-core/citations/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ judgmentText })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "تعذر تحليل الحكم.");
      setAnalysis(data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "تعذر تحليل الحكم.");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setJudgmentText("");
    setAnalysis(null);
    setError("");
    setDecisions({});
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[var(--r-xl)] border border-[var(--gold-border)] bg-[var(--paper)] p-5 shadow-[var(--sh-xs)]">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display-ar text-xl font-bold text-[var(--navy)]">نص الحكم القضائي</h2>
            <p className="mt-1 text-sm leading-7 text-[var(--ink-60)]">
              الصق نص حكم قضائي، فيلتقط المحرك إشاراته إلى مواد الأنظمة، ويحلها إلى النص الأصلي، ويصنف موقف المحكمة منها.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-outline" type="button" onClick={() => setJudgmentText(sampleJudgment)}>
              <FileText size={16} />
              تحميل نموذج توضيحي
            </button>
            <button className="btn btn-outline" type="button" onClick={reset}>
              <RefreshCcw size={16} />
              مسح
            </button>
          </div>
        </div>
        <textarea
          value={judgmentText}
          onChange={(event) => setJudgmentText(event.target.value)}
          className="min-h-[320px] w-full rounded-[var(--r-lg)] border border-[var(--ink-15)] bg-[var(--parchment)] p-4 font-judicial text-lg leading-9 text-[var(--ink)] outline-none focus:border-[var(--gold)]"
          placeholder="الصق نص الحكم هنا..."
        />
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-[var(--ink-60)]">عدد الأحرف: {judgmentText.length.toLocaleString("ar-SA")}</p>
          <button className="btn btn-gold min-w-[170px]" type="button" onClick={() => void analyze()} disabled={loading}>
            {loading ? <Loader2 className="animate-spin" size={16} /> : <ClipboardCopy size={16} />}
            تحليل الحكم
          </button>
        </div>
        {error ? (
          <div className="mt-4 rounded-[var(--r-md)] border border-[rgba(140,34,51,.25)] bg-[var(--ruby-soft)] p-3 text-sm text-[var(--ruby)]">
            {error}
          </div>
        ) : null}
      </section>

      {analysis ? (
        <section className="space-y-4">
          <div className="grid gap-3 md:grid-cols-5">
            <Stat label="الإشارات المكتشفة" value={analysis.detectedCount} />
            <Stat label="الإشارات المحلولة" value={analysis.resolvedCount} tone="emerald" />
            <Stat label="غير المحلولة" value={analysis.unresolvedCount} tone="ruby" />
            <Stat label="المعتمدة مؤقتًا" value={decisionStats.approved} tone="emerald" />
            <Stat label="المرفوضة مؤقتًا" value={decisionStats.rejected} tone="ruby" />
          </div>

          {analysis.message ? (
            <div className="rounded-[var(--r-lg)] border border-dashed border-[var(--gold-border)] bg-[var(--gold-ghost)] p-5 text-center text-[var(--navy)]">
              {analysis.message}
            </div>
          ) : null}

          <div className="space-y-3">
            {analysis.citations.map((citation, index) => (
              <article key={`${citation.rawText}-${index}`} className="rounded-[var(--r-xl)] border border-[var(--ink-08)] bg-[var(--paper)] p-5 shadow-[var(--sh-xs)]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-display-ar text-sm font-bold text-[var(--gold)]">النص الملتقط</p>
                    <p className="mt-2 font-judicial text-xl leading-8 text-[var(--ink)]">{citation.rawText}</p>
                  </div>
                  <span className={`rounded-full border px-3 py-1 font-display-ar text-xs font-bold ${positionLabels[citation.courtPosition].className}`}>
                    {positionLabels[citation.courtPosition].label}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-4">
                  <Info label="النظام" value={citation.systemName ?? "غير محدد"} />
                  <Info label="رقم المادة" value={citation.articleNumber ? citation.articleNumber.toLocaleString("ar-SA") : "غير محدد"} />
                  <Info label="الموضع" value={citation.section} />
                  <Info label="الثقة" value={`${Math.round(citation.confidence * 100).toLocaleString("ar-SA")}%`} />
                </div>

                <div className="mt-4 rounded-[var(--r-lg)] border border-[var(--ink-08)] bg-ivory/55 p-4">
                  {citation.resolvedArticleText ? (
                    <>
                      <div className="mb-2 flex items-center gap-2 text-sm font-bold text-[var(--emerald)]">
                        <CheckCircle2 size={16} />
                        تم حل الإشارة إلى مادة موجودة في legal_articles
                      </div>
                      <p className="line-clamp-5 font-judicial text-lg leading-9 text-[var(--ink)]">{citation.resolvedArticleText}</p>
                    </>
                  ) : (
                    <div className="flex items-center gap-2 text-sm font-bold text-[var(--ruby)]">
                      <ShieldAlert size={16} />
                      لم يتم حل هذه الإشارة إلى مادة موجودة في قاعدة البيانات الحالية.
                    </div>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <LegalCopyButton
                    text={`${citation.systemName ?? "نظام غير محدد"}، المادة ${citation.articleNumber ?? "غير محددة"}: ${citation.rawText}`}
                    label="نسخ الاستشهاد"
                  />
                  <button className="btn btn-primary" type="button" onClick={() => setDecisions((current) => ({ ...current, [index]: "approved" }))}>
                    <CheckCircle2 size={16} />
                    اعتماد
                  </button>
                  <button className="btn btn-outline" type="button" onClick={() => setDecisions((current) => ({ ...current, [index]: "rejected" }))}>
                    <XCircle size={16} />
                    رفض
                  </button>
                  <button className="btn btn-outline" type="button" onClick={() => setDecisions((current) => ({ ...current, [index]: "manual" }))}>
                    تعديل يدوي
                  </button>
                  {decisions[index] ? <span className="rounded-full border border-[var(--gold-border)] bg-[var(--gold-ghost)] px-3 py-2 text-xs font-bold text-[var(--navy)]">الحالة المؤقتة: {decisionLabel(decisions[index])}</span> : null}
                </div>
              </article>
            ))}
          </div>

          <section className="rounded-[var(--r-xl)] border border-[var(--ink-08)] bg-[var(--paper)] p-5 shadow-[var(--sh-xs)]">
            <h2 className="font-display-ar text-lg font-bold text-[var(--navy)]">الفهرس العكسي المؤقت</h2>
            <p className="mt-1 text-sm leading-7 text-[var(--ink-60)]">المادة ← الإشارات التي استشهدت بها في النص الملصق. هذا عرض مؤقت قابل لاحقًا للحفظ في جدول دائم.</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {analysis.reverseIndex.length ? analysis.reverseIndex.map((item) => (
                <div key={item.articleId} className="rounded-[var(--r-md)] border border-[var(--ink-08)] bg-ivory/60 p-3">
                  <p className="font-mono-legal text-sm text-[var(--gold)]">{item.systemName} | المادة {item.articleNumber.toLocaleString("ar-SA")}</p>
                  <p className="mt-1 text-sm text-[var(--ink-70)]">عدد الإشارات: {item.references.toLocaleString("ar-SA")}</p>
                </div>
              )) : (
                <p className="text-sm text-[var(--ink-60)]">لا يوجد فهرس عكسي محلول في هذا التحليل.</p>
              )}
            </div>
          </section>
        </section>
      ) : null}
    </div>
  );
}

function Stat({ label, value, tone = "navy" }: { label: string; value: number; tone?: "navy" | "emerald" | "ruby" }) {
  const toneClass = tone === "emerald" ? "text-[var(--emerald)]" : tone === "ruby" ? "text-[var(--ruby)]" : "text-[var(--navy)]";
  return (
    <div className="rounded-[var(--r-lg)] border border-[var(--ink-08)] bg-[var(--paper)] p-4">
      <p className="font-display-ar text-xs font-bold text-[var(--ink-60)]">{label}</p>
      <p className={`mt-2 font-judicial text-3xl font-bold ${toneClass}`}>{value.toLocaleString("ar-SA")}</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--r-md)] border border-[var(--ink-08)] bg-ivory/60 p-3">
      <p className="font-display-ar text-xs font-bold text-[var(--gold)]">{label}</p>
      <p className="mt-1 text-sm text-[var(--ink-70)]">{value}</p>
    </div>
  );
}

function decisionLabel(value: "approved" | "rejected" | "manual") {
  if (value === "approved") return "معتمد";
  if (value === "rejected") return "مرفوض";
  return "تعديل يدوي";
}

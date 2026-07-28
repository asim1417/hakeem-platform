"use client";

import { useState } from "react";

type RemedyKind = "appeal" | "cassation" | "reconsideration";

type RemedyConfig = {
  kind: RemedyKind;
  apiKind: string;
  title: string;
  description: string;
  reasonLabel: string;
  // أسبابٌ مؤصَّلة: لكلّ سببٍ مرجعُه النظاميّ الإرشاديّ (منقولٌ من تبويبات القاعة الكلاسيكيّة).
  reasons: Array<{ label: string; ref: string }>;
  // مسار مراحل الاعتراض (شريط تتبّع منقول من apS0–apS3 في النسخة السابقة).
  stages: string[];
  // مواد اللائحة المرجعيّة للنطاق.
  refNote: string;
  extraFields: Array<{ key: string; label: string; placeholder: string }>;
};

const configs: Record<RemedyKind, RemedyConfig> = {
  appeal: {
    kind: "appeal",
    apiKind: "استئناف",
    title: "لائحة الاستئناف",
    description: "مسودة تدريبية لمراجعة الحكم من حيث الوقائع والتسبيب وتطبيق النظام. دائرة الاستئناف تُحيل للحكم الابتدائيّ ولا تُعيد سرد الوقائع.",
    reasonLabel: "أسباب الاستئناف",
    reasons: [
      { label: "خطأ في التكييف", ref: "نظام المرافعات الشرعية" },
      { label: "قصور في التسبيب", ref: "نظام المحاكم التجارية — التسبيب" },
      { label: "مخالفة الثابت بالأوراق", ref: "نظام الإثبات" },
      { label: "خطأ في تطبيق النظام", ref: "نظام المعاملات المدنية" },
      { label: "عدم الرد على دفوع جوهرية", ref: "نظام المرافعات الشرعية" },
      { label: "الحكم بما لم يُطلَب", ref: "نظام المرافعات الشرعية — حظر الحكم بما لم يُطلَب" }
    ],
    stages: ["نافذة الاستئناف (المهلة)", "تقديم لائحة الطعن", "نظر الاستئناف", "حكم الاستئناف"],
    refNote: "مواد لائحة الاعتراض على الأحكام — الاستئناف.",
    extraFields: [
      { key: "requests", label: "الطلبات", placeholder: "مثال: إلغاء الحكم محل الاعتراض، الحكم مجددًا بالطلبات، أو إعادته للنظر." },
      { key: "attachments", label: "المرفقات", placeholder: "اذكر المستندات أو المرفقات المؤيدة للاعتراض إن وجدت." }
    ]
  },
  cassation: {
    kind: "cassation",
    apiKind: "نقض",
    title: "طلب النقض",
    description: "مسودة تدريبية مركزة على مخالفة النظام أو الخطأ في تطبيقه أو تكييفه أو الإخلال بإجراءٍ جوهريّ. النقض ≠ الاستئناف: لا يُعاد بحث الموضوع.",
    reasonLabel: "أسباب النقض",
    reasons: [
      { label: "مخالفة النظام أو الخطأ في تطبيقه", ref: "نظام المحاكم التجارية م/193" },
      { label: "القصور في التسبيب", ref: "نظام المحاكم التجارية — التسبيب" },
      { label: "مخالفة قواعد الاختصاص", ref: "نظام المرافعات الشرعية" },
      { label: "مخالفة إجراءٍ جوهريّ أثّر في الحكم", ref: "نظام المرافعات الشرعية" },
      { label: "الخطأ في تكييف الواقعة", ref: "نظام المعاملات المدنية" }
    ],
    stages: ["نافذة النقض (المهلة)", "تقديم أسباب النقض", "نظر المحكمة العليا", "قرار النقض / التأييد"],
    refNote: "أسباب النقض وطلباته وفق لائحة الاعتراض — النقض.",
    extraFields: [
      { key: "systemViolation", label: "مخالفة النظام أو الخطأ في تطبيقه", placeholder: "بيّن وجه مخالفة الحكم للنظام أو خطأه في التطبيق." },
      { key: "reasoningDefect", label: "القصور في التسبيب", placeholder: "بيّن موضع القصور أو عدم معالجة الدفوع الجوهرية." },
      { key: "requests", label: "الطلبات", placeholder: "مثال: نقض الحكم وإعادة القضية أو الحكم وفق الطلبات." }
    ]
  },
  reconsideration: {
    kind: "reconsideration",
    apiKind: "التماس إعادة نظر",
    title: "التماس إعادة النظر",
    description: "مسودة تدريبية للأسباب الاستثنائية التي تفتح مراجعة الحكم بعد صدوره. يُحسب الميعاد من تاريخ العلم بسبب الالتماس.",
    reasonLabel: "حالات الالتماس المقبولة",
    reasons: [
      { label: "ظهور أوراق قاطعة بعد الحكم", ref: "حالات الالتماس" },
      { label: "وقوع غش أو تدليس أثّر في الحكم", ref: "حالات الالتماس" },
      { label: "بناء الحكم على شهادة أو أوراق مزوّرة", ref: "حالات الالتماس" },
      { label: "تناقض منطوق الحكم", ref: "حالات الالتماس" },
      { label: "الحكم بما لم يطلبه الخصوم أو بأكثر منه", ref: "حالات الالتماس" },
      { label: "عدم التمثيل الصحيح للخصم", ref: "حالات الالتماس" }
    ],
    stages: ["العلم بسبب الالتماس", "احتساب الميعاد", "تقديم الالتماس", "نظر الالتماس"],
    refNote: "حالات الالتماس وميعاده (تاريخ العلم) وفق لائحة الاعتراض — الالتماس.",
    extraFields: [
      { key: "newEvidence", label: "الأوراق أو الواقعة الجديدة", placeholder: "صف الورقة القاطعة أو الواقعة التي ظهرت بعد الحكم." },
      { key: "knowledgeDate", label: "تاريخ العلم بسبب الالتماس", placeholder: "يُحسب الميعاد من هذا التاريخ." },
      { key: "requests", label: "الطلبات", placeholder: "حدد طلبات الملتمس من المحكمة." }
    ]
  }
};

export function PostJudgmentRemedyForm({ sessionId, remedyKind, disabled = false }: { sessionId: string; remedyKind: RemedyKind; disabled?: boolean }) {
  const config = configs[remedyKind];
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [draft, setDraft] = useState("");
  const [copied, setCopied] = useState(false);

  async function submit() {
    if (disabled) return;
    setBusy(true);
    setError("");
    setNotice("");
    setDraft("");
    try {
      const detailedReasons = [
        ...selectedReasons,
        ...config.extraFields.map((field) => fields[field.key]?.trim()).filter(Boolean)
      ];
      const response = await fetch(`/api/simulations/${sessionId}/appeal`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ kind: config.apiKind, reasons: detailedReasons })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.message ?? "تعذر حفظ مسودة الاعتراض.");
      setDraft(payload.decision?.content ?? "");
      setNotice("تم حفظ المسودة في سجل قرارات المحاكاة.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر حفظ مسودة الاعتراض.");
    } finally {
      setBusy(false);
    }
  }

  async function copyDraft() {
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* المتصفّح قد يمنع النسخ */
    }
  }

  return (
    <section className="space-y-5" dir="rtl">
      {disabled ? (
        <div className="rounded-[var(--r-lg)] border border-dashed border-[var(--gold-border)] bg-[var(--gold-ghost)] p-5 text-center text-sm leading-7 text-[var(--navy)]">
          لا يمكن فتح مرحلة الاعتراض قبل صدور الحكم.
        </div>
      ) : null}

      <div className="rounded-[var(--r-xl)] border border-[var(--gold-border)] bg-[var(--paper)] p-5 shadow-[var(--sh-xs)]">
        <p className="font-display-ar text-sm font-bold text-[var(--gold)]">مرحلة ما بعد الحكم</p>
        <h2 className="mt-1 font-judicial text-3xl font-bold text-[var(--navy)]">{config.title}</h2>
        <p className="mt-2 text-sm leading-7 text-[var(--ink-60)]">{config.description}</p>
      </div>

      {/* شريط مراحل الاعتراض (منقول من apS0–apS3) */}
      <div className="flex items-center gap-1 overflow-x-auto rounded-[var(--r-lg)] border border-[var(--ink-08)] bg-ivory/60 p-2">
        {config.stages.map((stage, index) => (
          <div key={stage} className="flex flex-none items-center gap-1">
            <span className="whitespace-nowrap rounded-full bg-[var(--surface)] px-3 py-1 text-[11px] font-semibold text-[var(--navy)]">{index + 1}. {stage}</span>
            {index < config.stages.length - 1 ? <span className="text-[var(--ink-40)]">←</span> : null}
          </div>
        ))}
      </div>

      <div className="grid w-full max-w-full gap-5 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-5">
          <div className="rounded-[var(--r-xl)] border border-[var(--ink-08)] bg-[var(--paper)] p-5">
            <h3 className="font-display-ar text-lg font-bold text-[var(--navy)]">{config.reasonLabel}</h3>
            <div className="mt-4 grid w-full max-w-full gap-3 sm:grid-cols-2">
              {config.reasons.map((reason) => (
                <label key={reason.label} className="grid min-w-0 grid-cols-[44px_minmax(0,1fr)] items-start gap-3 rounded-[var(--r-lg)] border border-[var(--ink-08)] bg-ivory/65 p-4">
                  <input
                    className="mt-1 h-5 w-5"
                    type="checkbox"
                    checked={selectedReasons.includes(reason.label)}
                    onChange={(event) => setSelectedReasons((current) => event.target.checked ? [...current, reason.label] : current.filter((item) => item !== reason.label))}
                    disabled={disabled}
                  />
                  <span className="min-w-0 [overflow-wrap:anywhere]">
                    <span className="block text-sm font-semibold leading-7 text-[var(--navy)]">{reason.label}</span>
                    <span className="mt-0.5 block text-[11px] font-semibold text-[var(--gold)]">المرجع النظاميّ (إرشاديّ): {reason.ref}</span>
                  </span>
                </label>
              ))}
            </div>
            <p className="mt-3 text-[11px] leading-6 text-[var(--ink-60)]">{config.refNote} المراجع أعلاه إرشاديّة؛ والاستشهاد النهائيّ في المسودة يُسترجَع مؤصَّلًا من النواة.</p>
          </div>

          <div className="rounded-[var(--r-xl)] border border-[var(--ink-08)] bg-[var(--paper)] p-5">
            <h3 className="font-display-ar text-lg font-bold text-[var(--navy)]">تفاصيل الطلب</h3>
            <div className="mt-4 space-y-4">
              {config.extraFields.map((field) => (
                <label key={field.key} className="block">
                  <span className="font-display-ar text-sm font-bold text-[var(--navy)]">{field.label}</span>
                  <textarea
                    className="mt-2 min-h-[120px] w-full rounded-[var(--r-md)] border border-[var(--ink-15)] bg-[var(--parchment)] p-4 leading-8 outline-none focus:border-[var(--gold)]"
                    placeholder={field.placeholder}
                    value={fields[field.key] ?? ""}
                    onChange={(event) => setFields((current) => ({ ...current, [field.key]: event.target.value }))}
                    disabled={disabled}
                  />
                </label>
              ))}
            </div>
          </div>
        </div>

        <aside className="min-w-0 space-y-4">
          <div className="rounded-[var(--r-xl)] border border-[var(--gold-border)] bg-[var(--gold-ghost)] p-5 text-sm leading-7 text-[var(--navy)]">
            <strong className="font-display-ar">تنبيه مهني:</strong>
            <p className="mt-2">هذه المسودة تدريبية وغير ملزمة، ولا تعد إجراءً قضائيًا فعليًا أو رأيًا قانونيًا نهائيًا.</p>
          </div>
          <button className="btn btn-gold w-full justify-center" type="button" onClick={() => void submit()} disabled={disabled || busy}>
            {busy ? "جار توليد المسودة..." : `توليد مسودة ${config.title}`}
          </button>
          {notice ? <div className="rounded-[var(--r-md)] border border-[rgba(26,92,65,.25)] bg-[var(--emerald-soft)] p-4 text-sm text-[var(--emerald)]">{notice}</div> : null}
          {error ? <div className="rounded-[var(--r-md)] border border-[rgba(140,34,51,.25)] bg-[var(--ruby-soft)] p-4 text-sm text-[var(--ruby)]">{error}</div> : null}
          {draft ? (
            <div className="rounded-[var(--r-xl)] border border-[var(--ink-08)] bg-[var(--parchment)] p-5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display-ar text-base font-bold text-[var(--navy)]">المسودة المحفوظة</h3>
                <button type="button" onClick={() => void copyDraft()} className="rounded-[var(--r-md)] border border-[var(--ink-15)] bg-[var(--paper)] px-3 py-1 text-[11px] font-semibold text-[var(--ink-60)] hover:border-[var(--gold)]">{copied ? "نُسخ" : "نسخ"}</button>
              </div>
              <pre className="mt-3 whitespace-pre-wrap font-judicial text-lg leading-9 text-[var(--ink)]">{draft}</pre>
            </div>
          ) : null}
          <div className="rounded-[var(--r-xl)] border border-[var(--ink-08)] bg-ivory/60 p-4">
            <p className="mb-2 text-xs font-semibold text-[var(--ink-60)]">تصدير لوائح الاعتراض</p>
            <div className="flex flex-wrap gap-2">
              <a href={`/api/simulations/${sessionId}/export?type=objection&format=pdf`} className="rounded-[var(--r-md)] border border-[var(--ink-15)] bg-[var(--paper)] px-3 py-1.5 text-xs font-semibold text-[var(--navy)] hover:border-[var(--gold)]">PDF</a>
              <a href={`/api/simulations/${sessionId}/export?type=objection&format=docx`} className="rounded-[var(--r-md)] border border-[var(--ink-15)] bg-[var(--paper)] px-3 py-1.5 text-xs font-semibold text-[var(--navy)] hover:border-[var(--gold)]">Word</a>
            </div>
            <p className="mt-2 text-[11px] leading-5 text-[var(--ink-60)]">يُصدَّر ما حُفظ من لوائح الاعتراض في هذه الجلسة (بعد توليد المسودة وحفظها).</p>
          </div>
        </aside>
      </div>
    </section>
  );
}

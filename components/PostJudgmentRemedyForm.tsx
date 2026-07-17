"use client";

import { useState } from "react";

type RemedyKind = "appeal" | "cassation" | "reconsideration";

type RemedyConfig = {
  kind: RemedyKind;
  apiKind: string;
  title: string;
  description: string;
  reasonLabel: string;
  reasons: string[];
  extraFields: Array<{ key: string; label: string; placeholder: string }>;
};

const configs: Record<RemedyKind, RemedyConfig> = {
  appeal: {
    kind: "appeal",
    apiKind: "استئناف",
    title: "لائحة الاستئناف",
    description: "مسودة تدريبية لمراجعة الحكم من حيث الوقائع والتسبيب وتطبيق النظام.",
    reasonLabel: "أسباب الاستئناف",
    reasons: ["خطأ في التكييف", "قصور في التسبيب", "مخالفة الثابت بالأوراق", "خطأ في تطبيق النظام", "عدم الرد على دفوع جوهرية"],
    extraFields: [
      { key: "requests", label: "الطلبات", placeholder: "مثال: نقض الحكم محل الاعتراض، الحكم مجددًا بالطلبات، أو إعادته للنظر." },
      { key: "attachments", label: "المرفقات", placeholder: "اذكر المستندات أو المرفقات المؤيدة للاعتراض إن وجدت." }
    ]
  },
  cassation: {
    kind: "cassation",
    apiKind: "نقض",
    title: "طلب النقض",
    description: "مسودة تدريبية مركزة على مخالفة النظام أو الخطأ في تطبيقه أو القصور في التسبيب.",
    reasonLabel: "أسباب النقض",
    reasons: ["مخالفة النظام أو الخطأ في تطبيقه", "القصور في التسبيب", "مخالفة الاختصاص", "مخالفة الإجراءات الجوهرية", "الخطأ في تكييف الواقعة"],
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
    description: "مسودة تدريبية للأسباب الاستثنائية التي تفتح مراجعة الحكم بعد صدوره.",
    reasonLabel: "سبب الالتماس",
    reasons: ["ظهور أوراق قاطعة", "وقوع غش أو تزوير", "تناقض منطوق الحكم", "الحكم بما لم يطلبه الخصوم", "عدم التمثيل الصحيح"],
    extraFields: [
      { key: "newEvidence", label: "الأوراق أو الواقعة الجديدة", placeholder: "صف الورقة القاطعة أو الواقعة التي ظهرت بعد الحكم." },
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

      <div className="grid w-full max-w-full gap-5 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-5">
          <div className="rounded-[var(--r-xl)] border border-[var(--ink-08)] bg-[var(--paper)] p-5">
            <h3 className="font-display-ar text-lg font-bold text-[var(--navy)]">{config.reasonLabel}</h3>
            <div className="mt-4 grid w-full max-w-full gap-3 sm:grid-cols-2">
              {config.reasons.map((reason) => (
                <label key={reason} className="grid min-w-0 grid-cols-[44px_minmax(0,1fr)] items-start gap-3 rounded-[var(--r-lg)] border border-[var(--ink-08)] bg-ivory/65 p-4">
                  <input
                    className="mt-1 h-5 w-5"
                    type="checkbox"
                    checked={selectedReasons.includes(reason)}
                    onChange={(event) => setSelectedReasons((current) => event.target.checked ? [...current, reason] : current.filter((item) => item !== reason))}
                    disabled={disabled}
                  />
                  <span className="min-w-0 text-sm font-semibold leading-7 text-[var(--navy)] [overflow-wrap:anywhere]">{reason}</span>
                </label>
              ))}
            </div>
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
              <h3 className="font-display-ar text-base font-bold text-[var(--navy)]">المسودة المحفوظة</h3>
              <pre className="mt-3 whitespace-pre-wrap font-judicial text-lg leading-9 text-[var(--ink)]">{draft}</pre>
            </div>
          ) : null}
          <div className="rounded-[var(--r-xl)] border border-dashed border-[var(--gold-border)] bg-ivory/60 p-4 text-xs leading-6 text-[var(--ink-60)]">
            التصدير PDF/DOCX متاح حاليًا للحكم وضبط الجلسة عبر صفحة الحكم. تصدير لوائح الاعتراض كملفات مستقلة يحتاج مسار تصدير مخصص لاحقًا.
          </div>
        </aside>
      </div>
    </section>
  );
}

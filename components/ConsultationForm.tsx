"use client";

import { useState } from "react";
import { Paperclip } from "lucide-react";
import { extractFile } from "@/lib/modules/doc-tool/extract";
import { LegalBasisPanel, type LegalBasisItem } from "@/components/legal/LegalBasisPanel";

type Citation = {
  articleId: string;
  lawName: string;
  articleNumber: number;
  quote: string;
};

type ConsultationResult = {
  summary: string;
  analysis: string;
  result: string;
  citations: Citation[];
  warning: string;
  consultationId?: string;
  blocked?: boolean;
};

const matterTypes = ["مدنية", "تجارية", "عمالية", "أحوال شخصية", "تنفيذ", "أخرى"];

export function ConsultationForm({ defaultFacts = "" }: { defaultFacts?: string }) {
  const [title, setTitle] = useState("");
  const [matterType, setMatterType] = useState(matterTypes[0]);
  const [facts, setFacts] = useState(defaultFacts);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ConsultationResult | null>(null);
  // محلّل منصّة الوثائق (extractFile) — استخراجٌ محليّ في المتصفّح؛ الملفّ لا يغادر الجهاز.
  const [extracting, setExtracting] = useState(false);
  const [attachNote, setAttachNote] = useState<string | null>(null);
  // موافقة صريحة على حفظ أسرار الموكّل (شرط الحفظ الكامل) — بلا موافقة يُخزَّن نصٌّ مُعمّى.
  const [consent, setConsent] = useState(false);

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setExtracting(true);
    setError("");
    setAttachNote(`أقرأ «${file.name}»…`);
    try {
      const r = await extractFile(file, (label) => setAttachNote(label));
      if (r.text.trim()) {
        setFacts((prev) => (prev.trim() ? `${prev.trim()}\n\n` : "") + r.text.trim());
        setAttachNote(`أُدرج نصّ «${file.name}» (${r.kind})${r.warning ? " · " + r.warning : ""}`);
      } else {
        setAttachNote(null);
        setError("لم أستخرج نصًّا من الملف. جرّب ملفًّا نصّيًّا أو Word أو PDF نصّيّ.");
      }
    } catch {
      setAttachNote(null);
      setError("تعذّر قراءة الملف.");
    } finally {
      setExtracting(false);
    }
  }

  async function submit() {
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch("/api/ai/consultation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({ title, matterType, facts, question, consentToStore: consent })
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.message ?? "تعذر تحليل الواقعة.");
      }
      if (payload?.blocked || payload?.reason === "exhausted") {
        setResult({
          summary: "",
          analysis: "",
          result: "",
          citations: [],
          warning: "انتهى رصيدك المجاني للوحدات المتقدّمة.",
          blocked: true,
        });
        return;
      }

      setResult(payload as ConsultationResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تحليل الواقعة.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-md border border-line bg-ivory p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="text-sm font-semibold text-olive">عنوان الاستشارة</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="focus-ring mt-2 w-full rounded-md border border-line px-4 py-3"
              placeholder="مثال: نزاع توريد مواد بناء"
            />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-olive">نوع المسألة</span>
            <select
              value={matterType}
              onChange={(event) => setMatterType(event.target.value)}
              className="focus-ring mt-2 w-full rounded-md border border-line px-4 py-3"
            >
              {matterTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="mt-4 block">
          <span className="text-sm font-semibold text-olive">نص الواقعة</span>
          <textarea
            value={facts}
            onChange={(event) => setFacts(event.target.value)}
            className="focus-ring mt-2 min-h-40 w-full rounded-md border border-line px-4 py-3 leading-8"
            placeholder="اكتب الوقائع القانونية بتفصيل كاف، أو أرفق مستندًا لاستخراج نصّه…"
          />
        </label>

        {/* محلّل منصّة الوثائق: أرفق مستندًا (Word · PDF · نصّ · صورة) فيُستخرَج نصّه محليًّا ويُدرَج في الواقعة */}
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="focus-ring inline-flex cursor-pointer items-center gap-2 rounded-md border border-line bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-[var(--petrol)] transition hover:border-[var(--copper)]">
            <Paperclip size={15} aria-hidden />
            {extracting ? "جارٍ الاستخراج…" : "إرفاق مستند"}
            <input type="file" accept=".txt,.md,.csv,.json,.docx,.pdf,.png,.jpg,.jpeg,.webp" className="sr-only" onChange={onFile} disabled={extracting} />
          </label>
          {attachNote ? <span className="text-xs leading-6 text-[var(--muted)]">{attachNote}</span> : null}
          <span className="text-[11px] text-[var(--ink-40)]">الملفّ يُقرأ في متصفّحك ولا يُرفع لأيّ خادم.</span>
        </div>

        <label className="mt-4 block">
          <span className="text-sm font-semibold text-olive">طلب المستخدم أو السؤال القانوني</span>
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            className="focus-ring mt-2 min-h-24 w-full rounded-md border border-line px-4 py-3 leading-8"
            placeholder="مثال: هل يحق للشركة خصم قيمة المواد المعيبة؟"
          />
        </label>

        {/* موافقة صريحة على حفظ أسرار الموكّل — شرط الحفظ الكامل. بلا موافقة يُخزَّن نصٌّ مُعمّى. */}
        <label className="mt-4 flex items-start gap-2.5 rounded-md border border-line bg-[var(--surface)] p-3 text-sm leading-7 text-[var(--ink-80)]">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1.5 shrink-0" />
          <span>
            أوافق صراحةً على <b className="font-semibold text-[var(--petrol)]">حفظ هذه الواقعة كاملةً</b> (بما فيها بيانات موكّلي) في سجلّي للرجوع إليها.
            <span className="mt-0.5 block text-xs text-[var(--muted)]">بدون الموافقة: تُحلَّل الواقعة ويُحفَظ سجلٌّ <b>مُعمّى</b> بلا معرّفات الأطراف.</span>
          </span>
        </label>

        <button
          type="button"
          onClick={() => void submit()}
          disabled={loading || extracting || facts.trim().length < 20}
          className="focus-ring mt-5 rounded-md bg-olive px-5 py-3 text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "جار تحليل الواقعة..." : "تحليل الواقعة"}
        </button>
      </section>

      {error ? <div className="rounded-md border border-red-200 bg-red-50 p-4 text-red-700">{error}</div> : null}

      {result?.blocked ? (
        <section className="rounded-[var(--r-xl)] border border-[rgba(140,34,51,0.3)] bg-[var(--ruby-soft)] p-6">
          <h2 className="t-head text-xl font-bold text-[var(--ruby)]">انتهى الرصيد المجاني</h2>
          <p className="mt-2 text-sm leading-7 text-[var(--ruby)]">
            الوحدات المتقدّمة تتطلب ترقية الخطة أو انتظار تفعيل الاشتراك. تصفّح النواة القانونية يبقى متاحًا.
          </p>
          <a
            href="/dashboard/subscribe"
            className="focus-ring mt-4 inline-flex rounded-[var(--r-md)] bg-[var(--navy)] px-5 py-2.5 text-sm font-semibold text-white"
          >
            عرض خطط الاشتراك
          </a>
        </section>
      ) : null}

      {result && !result.blocked ? (
        <section className="rounded-[var(--r-xl)] border border-[var(--ink-08)] bg-ivory p-6 shadow-[var(--sh-xs)]">
          <p className="rounded-[var(--r-md)] border border-[var(--amber-soft)] bg-[var(--amber-soft)] p-4 text-sm leading-7 text-[var(--amber)]">
            {result.warning}
          </p>
          <h2 className="t-head mt-5 text-xl font-bold text-[var(--navy)]">نتيجة التحليل</h2>
          <p className="mt-3 whitespace-pre-wrap rounded-[var(--r-lg)] border border-[var(--ink-08)] bg-[var(--hakeem-bg-soft)] p-4 leading-8 text-[var(--ink-80)]">
            {result.analysis}
          </p>
          <p className="mt-4 font-semibold text-[var(--navy)]">{result.result}</p>
          {result.consultationId ? (
            <p className="mt-2 font-mono-legal text-xs text-[var(--ink-60)]">رقم الاستشارة: {result.consultationId}</p>
          ) : null}

          <div className="mt-6">
            <LegalBasisPanel
              items={result.citations.map<LegalBasisItem>((citation) => ({
                systemName: citation.lawName,
                articleNumber: citation.articleNumber,
                quote: citation.quote,
                state: "official",
                internalUrl: `/dashboard/legal-core/articles/${citation.articleId}`
              }))}
            />
          </div>
        </section>
      ) : null}
    </div>
  );
}

import { requirePagePermission } from "@/lib/modules/auth/session";
import { legalRag, type RagResult } from "@/lib/modules/legal-rag/legal-rag-service";

export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<string, string> = { article: "مادة", ruling: "حكم", principle: "مبدأ" };

export default async function LegalRagPage({ searchParams }: { searchParams: { q?: string } }) {
  await requirePagePermission("LEGAL_CORE_VIEW");

  const q = (searchParams.q ?? "").trim();
  let result: RagResult | null = null;
  let failed = false;
  if (q.length >= 3) {
    try {
      result = await legalRag(q);
    } catch {
      failed = true;
    }
  }

  return (
    <div dir="rtl">
      <p className="text-sm font-semibold text-gold">الذكاء القانوني المُسنَد (Legal RAG)</p>
      <h1 className="mt-2 text-3xl font-bold text-olive">صفحة اختبار الإجابة المنضبطة بالمصادر</h1>
      <p className="mt-3 max-w-3xl leading-8 text-gray-700">
        كل إجابة تمرّ بـ: بحث هجين → سياق قانوني → محرّك استشهاد → نموذج بتعليمات إسناد صارمة. لا إجابة بلا مصدر حقيقي.
      </p>

      <form className="mt-6 flex flex-wrap items-center gap-2" action="/dashboard/legal-rag">
        <input
          name="q"
          defaultValue={q}
          placeholder="مثال: هل يجوز فسخ العقد بسبب الغبن؟"
          className="min-w-[300px] flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded-md bg-olive px-5 py-2 text-sm text-white">اسأل</button>
      </form>

      {failed && (
        <div className="mt-6 rounded-md border border-amber-300 bg-amber-50 p-4 text-amber-800">
          ⚠ تعذّر تشغيل المحرّك (قد تكون جداول/امتدادات القاعدة غير مُفعّلة محلياً بعد).
        </div>
      )}

      {result && (
        <div className="mt-6 space-y-5">
          {/* الإجابة + الثقة */}
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-olive">الإجابة</span>
              <span className="ms-auto rounded bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700 tabular-nums">
                الثقة {(result.confidence * 100).toFixed(0)}%
              </span>
              {!result.grounded && <span className="rounded bg-red-50 px-2 py-0.5 text-xs text-red-600">غير مُسنَد</span>}
              {result.grounded && !result.generated && (
                <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500">مصادر فقط (الذكاء غير مُفعّل)</span>
              )}
            </div>
            <p className="mt-3 whitespace-pre-wrap leading-8 text-gray-800">{result.answer}</p>
          </div>

          <SourceGroup title="المواد النظامية المستخدمة" items={result.relatedArticles} type="article" />
          <SourceGroup title="الأحكام المستخدمة" items={result.relatedRulings} type="ruling" />
          <SourceGroup title="المبادئ المستخدمة" items={result.relatedPrinciples} type="principle" />

          {/* الاستشهادات */}
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="font-semibold text-olive">الاستشهادات الكاملة ({result.citations.length})</div>
            {result.citations.length === 0 ? (
              <p className="mt-2 text-sm text-gray-400">لا استشهادات.</p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm">
                {result.citations.map((c) => (
                  <li key={`${c.sourceType}:${c.sourceId}`} className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-gold/10 px-1.5 py-0.5 text-xs text-gold">{TYPE_LABELS[c.sourceType]}</span>
                    <span className="text-gray-700">{c.reference}</span>
                    <span className="ms-auto text-xs text-gray-400 tabular-nums">ثقة {(c.confidence * 100).toFixed(0)}%</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SourceGroup({
  title,
  items,
  type,
}: {
  title: string;
  items: Array<{ id: string; title: string; reason: string; weight: number }>;
  type: string;
}) {
  if (items.length === 0) return null;
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="font-semibold text-olive">
        {title} ({items.length})
      </div>
      <ul className="mt-2 space-y-2 text-sm">
        {items.map((it) => (
          <li key={it.id} className="border-t border-gray-100 pt-2">
            <div className="flex items-center gap-2">
              <span className="rounded bg-gold/10 px-1.5 py-0.5 text-xs text-gold">{TYPE_LABELS[type]}</span>
              <span className="text-gray-800">{it.title}</span>
              <span className="ms-auto text-xs text-gray-400 tabular-nums">{(it.weight * 100).toFixed(0)}%</span>
            </div>
            <div className="mt-1 text-xs text-gray-400">سبب الظهور: {it.reason}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}

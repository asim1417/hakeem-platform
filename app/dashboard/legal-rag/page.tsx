import { requirePagePermission } from "@/lib/modules/auth/session";
import { legalRag, type RagResult } from "@/lib/modules/legal-rag/legal-rag-service";
import { GroundingWarning, LegalCitationBox, RelatedJudgmentsList } from "@/components/legal/legal-intelligence";

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
          {/* الإجابة المنظّمة + الثقة + المزوّد */}
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-olive">الإجابة المُسنَدة</span>
              <span className="rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                المزوّد: {result.provider}{result.model ? ` · ${result.model}` : ""}
              </span>
              <span className="ms-auto rounded bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700 tabular-nums">
                الثقة {(result.confidence * 100).toFixed(0)}%
              </span>
              {!result.grounded && <span className="rounded bg-red-50 px-2 py-0.5 text-xs text-red-600">غير مُسنَد</span>}
              {result.grounded && !result.generated && (
                <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500">سقوط منظّم (لم يُولَّد نصّ)</span>
              )}
            </div>

            {result.shortAnswer && (
              <div className="mt-4">
                <div className="text-sm font-semibold text-gold">الجواب المختصر</div>
                <p className="mt-1 whitespace-pre-wrap leading-8 text-gray-900">{result.shortAnswer}</p>
              </div>
            )}
            {result.legalAnalysis && (
              <div className="mt-4">
                <div className="text-sm font-semibold text-gold">التحليل النظامي</div>
                <p className="mt-1 whitespace-pre-wrap leading-8 text-gray-800">{result.legalAnalysis}</p>
              </div>
            )}
            {result.limitations && (
              <div className="mt-4 rounded-md bg-amber-50 p-3">
                <div className="text-sm font-semibold text-amber-800">التحفظات</div>
                <p className="mt-1 whitespace-pre-wrap leading-7 text-amber-800">{result.limitations}</p>
              </div>
            )}

            <details className="mt-4">
              <summary className="cursor-pointer text-xs text-gray-400">عرض النصّ الكامل كما ولّده المزوّد</summary>
              <p className="mt-2 whitespace-pre-wrap leading-8 text-gray-700">{result.answer}</p>
            </details>
          </div>

          {/* تنبيهات الإسناد: لا مصادر كافية / لا نصّ صريح / سقوط منظّم */}
          <GroundingWarning
            grounded={result.grounded}
            generated={result.generated}
            legalBasisNote={result.legalBasisNote}
          />

          {/* صندوق الاستشهاد: الأساس النظامي + الاستشهادات المتحقّقة */}
          <LegalCitationBox
            legalBasis={result.legalBasis}
            citations={result.citations}
            legalBasisNote={result.legalBasisNote}
          />

          {/* الأحكام المرتبطة (سوابق مؤيِّدة لا أساس نظامي) */}
          <RelatedJudgmentsList items={result.relatedRulings} title="أحكام مرتبطة" />

          <SourceGroup title="المبادئ المستخدمة" items={result.relatedPrinciples} type="principle" />
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

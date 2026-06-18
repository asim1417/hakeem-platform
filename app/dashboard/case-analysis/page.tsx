import { requirePagePermission } from "@/lib/modules/auth/session";
import { analyzeCase } from "@/lib/modules/case-analysis/case-analysis-engine";
import { DEFENSE_CATEGORY_LABELS } from "@/lib/modules/case-analysis/defense-classifier";
import type { CaseAnalysisResult } from "@/lib/modules/case-analysis/types";

export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<string, string> = { article: "مادة", ruling: "حكم", principle: "مبدأ" };

export default async function CaseAnalysisPage({
  searchParams,
}: {
  searchParams: { facts?: string; claims?: string; defenses?: string; caseType?: string };
}) {
  await requirePagePermission("LEGAL_CORE_VIEW");

  const facts = (searchParams.facts ?? "").trim();
  const claims = (searchParams.claims ?? "").trim();
  const defenses = (searchParams.defenses ?? "").trim();
  const caseType = (searchParams.caseType ?? "").trim();

  let result: CaseAnalysisResult | null = null;
  let failed = false;
  if (facts.length >= 10) {
    try {
      result = await analyzeCase({ facts, claims, defenses, caseType });
    } catch {
      failed = true;
    }
  }

  return (
    <div dir="rtl">
      <p className="text-sm font-semibold text-gold">محرك تحليل القضايا</p>
      <h1 className="mt-2 text-3xl font-bold text-olive">تحليل قانوني مُسنَد للدعوى (اختبار)</h1>
      <p className="mt-3 max-w-3xl leading-8 text-gray-700">
        يبني التحليل فوق الذكاء القانوني (Legal RAG): توصيف النزاع، الوقائع المنتِجة، عبء الإثبات، الدفوع المصنّفة، المخاطر،
        نقاط القوة والضعف، والمواد والأحكام المؤثّرة — مع تقدير أوّلي لقوة الدعوى وإسناد كامل.
      </p>

      <form className="mt-6 grid gap-3" action="/dashboard/case-analysis">
        <textarea
          name="facts"
          defaultValue={facts}
          rows={4}
          placeholder="وقائع الدعوى (إلزامي، ١٠ أحرف فأكثر)..."
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <div className="grid gap-3 md:grid-cols-2">
          <textarea name="claims" defaultValue={claims} rows={2} placeholder="طلبات المدعي (اختياري)..." className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
          <textarea name="defenses" defaultValue={defenses} rows={2} placeholder="دفوع المدعى عليه (اختياري)..." className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input name="caseType" defaultValue={caseType} placeholder="نوع القضية (تجاري/عمالي/مدني...)" className="min-w-[220px] flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm" />
          <button type="submit" className="rounded-md bg-olive px-6 py-2 text-sm text-white">حلّل القضية</button>
        </div>
      </form>

      {failed && (
        <div className="mt-6 rounded-md border border-amber-300 bg-amber-50 p-4 text-amber-800">
          ⚠ تعذّر تشغيل المحرّك (قد تكون جداول/امتدادات القاعدة غير مُفعّلة محلياً بعد).
        </div>
      )}

      {result && (
        <div className="mt-6 space-y-5">
          {/* الترويسة: قوة الدعوى + الثقة + المزوّد */}
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-semibold text-olive">التقدير العام</span>
              <span className="rounded bg-indigo-50 px-3 py-1 text-sm font-bold text-indigo-700 tabular-nums">
                قوة الدعوى {result.caseStrengthScore}/100
              </span>
              <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700 tabular-nums">
                ثقة الإسناد {(result.confidence * 100).toFixed(0)}%
              </span>
              <span className="rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                المزوّد: {result.provider}{result.model ? ` · ${result.model}` : ""}
              </span>
              {!result.grounded && <span className="rounded bg-red-50 px-2 py-0.5 text-xs text-red-600">إسناد محدود</span>}
            </div>
            <div className="mt-4">
              <div className="text-sm font-semibold text-gold">توصيف النزاع قانونياً</div>
              <p className="mt-1 leading-8 text-gray-900">{result.disputeCharacterization}</p>
            </div>
            <div className="mt-3">
              <div className="text-sm font-semibold text-gold">عبء الإثبات</div>
              <p className="mt-1 leading-8 text-gray-800">{result.burdenOfProof}</p>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <ListCard title="الوقائع المنتِجة" items={result.materialFacts} tone="emerald" />
            <ListCard title="الوقائع غير المنتِجة" items={result.immaterialFacts} tone="gray" />
            <ListCard title="عناصر الإثبات المطلوبة" items={result.requiredEvidence} tone="blue" />
            <ListCard title="المخاطر القانونية" items={result.legalRisks} tone="amber" />
            <ListCard title="نقاط القوة" items={result.strengths} tone="emerald" />
            <ListCard title="نقاط الضعف" items={result.weaknesses} tone="red" />
          </div>

          {/* الدفوع المحتملة مصنّفة */}
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="font-semibold text-olive">الدفوع المحتملة ({result.potentialDefenses.length})</div>
            {result.potentialDefenses.length === 0 ? (
              <p className="mt-2 text-sm text-gray-400">لا دفوع مقترحة.</p>
            ) : (
              <ul className="mt-2 space-y-2 text-sm">
                {result.potentialDefenses.map((d, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-2">
                    <span className="rounded bg-gold/10 px-1.5 py-0.5 text-xs text-gold">{DEFENSE_CATEGORY_LABELS[d.category]}</span>
                    <span className="text-gray-800">{d.text}</span>
                    {d.basis && <span className="ms-auto text-xs text-gray-400">السند: {d.basis}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <SourceGroup title="المواد النظامية المؤثّرة" items={result.influentialArticles.map((a) => ({ id: a.id, title: a.title, sub: a.reference, weight: a.weight }))} type="article" />
          <SourceGroup title="الأحكام المشابهة" items={result.similarRulings.map((r) => ({ id: r.id, title: r.title, sub: r.reason, weight: r.weight }))} type="ruling" />

          {/* الاستشهادات الكاملة */}
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="font-semibold text-olive">الاستشهادات الكاملة ({result.citations.length})</div>
            {result.citations.length === 0 ? (
              <p className="mt-2 text-sm text-gray-400">لا استشهادات مُتحقَّقة.</p>
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

const TONES: Record<string, string> = {
  emerald: "text-emerald-700",
  gray: "text-gray-600",
  blue: "text-blue-700",
  amber: "text-amber-700",
  red: "text-red-600",
};

function ListCard({ title, items, tone }: { title: string; items: string[]; tone: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className={`font-semibold ${TONES[tone] ?? "text-olive"}`}>
        {title} ({items.length})
      </div>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-gray-400">—</p>
      ) : (
        <ul className="mt-2 list-disc space-y-1 pe-5 text-sm text-gray-800">
          {items.map((it, i) => (
            <li key={i} className="leading-7">{it}</li>
          ))}
        </ul>
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
  items: Array<{ id: string; title: string; sub: string; weight: number }>;
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
            <div className="mt-1 text-xs text-gray-500">{it.sub}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}

import { requirePagePermission } from "@/lib/modules/auth/session";
import { runLegalAgent } from "@/lib/modules/legal-agent/legal-agent";
import { DEFENSE_CATEGORY_LABELS } from "@/lib/modules/case-analysis/defense-classifier";
import type { LegalActionPlan, PartyRole } from "@/lib/modules/legal-agent/types";

export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<string, string> = { article: "مادة", ruling: "حكم", principle: "مبدأ" };

export default async function LegalAgentPage({
  searchParams,
}: {
  searchParams: { caseFacts?: string; claims?: string; defenses?: string; documents?: string; partyRole?: string; jurisdiction?: string; caseType?: string };
}) {
  await requirePagePermission("LEGAL_CORE_VIEW");

  const caseFacts = (searchParams.caseFacts ?? "").trim();
  const claims = (searchParams.claims ?? "").trim();
  const defenses = (searchParams.defenses ?? "").trim();
  const jurisdiction = (searchParams.jurisdiction ?? "").trim();
  const caseType = (searchParams.caseType ?? "").trim();
  const documents = (searchParams.documents ?? "").split("\n").map((d) => d.trim()).filter(Boolean);
  const partyRole = (searchParams.partyRole === "PLAINTIFF" || searchParams.partyRole === "DEFENDANT" ? searchParams.partyRole : undefined) as PartyRole | undefined;

  let plan: LegalActionPlan | null = null;
  let failed = false;
  if (caseFacts.length >= 10) {
    try {
      plan = await runLegalAgent({ caseFacts, claims, defenses, documents, partyRole, jurisdiction, caseType });
    } catch {
      failed = true;
    }
  }

  return (
    <div dir="rtl">
      <p className="text-sm font-semibold text-gold">الوكيل القانوني</p>
      <h1 className="mt-2 text-3xl font-bold text-olive">خطة عمل قانونية للمحامي (اختبار)</h1>
      <p className="mt-3 max-w-3xl leading-8 text-gray-700">
        يحوّل الوكيل تحليل القضية (فوق Legal RAG) إلى خطة عملية: استراتيجية، دفوع مصنّفة، بيّنات، مخاطر، فرص نجاح، خطة مرافعة،
        وأسئلة وتوصية — باستشهادات حقيقية فقط، ومع تحفّظ صريح عند نقص المصادر.
      </p>

      <form className="mt-6 grid gap-3" action="/dashboard/legal-agent">
        <textarea name="caseFacts" defaultValue={caseFacts} rows={4} placeholder="وقائع الدعوى (إلزامي، ١٠ أحرف فأكثر)..." className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        <div className="grid gap-3 md:grid-cols-3">
          <select name="partyRole" defaultValue={partyRole ?? ""} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
            <option value="">دور الموكِّل…</option>
            <option value="PLAINTIFF">مدّعٍ</option>
            <option value="DEFENDANT">مدّعى عليه</option>
          </select>
          <input name="caseType" defaultValue={caseType} placeholder="نوع القضية (تجاري/تنفيذي…)" className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
          <input name="jurisdiction" defaultValue={jurisdiction} placeholder="جهة الاختصاص (المحكمة)" className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <textarea name="claims" defaultValue={claims} rows={2} placeholder="طلبات المدعي (اختياري)..." className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
          <textarea name="defenses" defaultValue={defenses} rows={2} placeholder="دفوع الخصم (اختياري)..." className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <textarea name="documents" defaultValue={documents.join("\n")} rows={2} placeholder="المستندات (سطر لكل مستند، اختياري)..." className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        <div>
          <button type="submit" className="rounded-md bg-olive px-6 py-2 text-sm text-white">حلّل وخطّط</button>
        </div>
      </form>

      {failed && (
        <div className="mt-6 rounded-md border border-amber-300 bg-amber-50 p-4 text-amber-800">
          ⚠ تعذّر تشغيل الوكيل (قد تكون جداول/امتدادات القاعدة غير مُفعّلة محلياً بعد).
        </div>
      )}

      {plan && (
        <div className="mt-6 space-y-5">
          {plan.preliminary && plan.disclaimer && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-4 font-semibold text-amber-800">⚠ {plan.disclaimer}</div>
          )}

          {/* الترويسة */}
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-semibold text-olive">التقدير العام</span>
              <span className="rounded bg-indigo-50 px-3 py-1 text-sm font-bold text-indigo-700 tabular-nums">قوة الدعوى {plan.caseStrengthScore}/100</span>
              <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700 tabular-nums">الثقة {(plan.confidence * 100).toFixed(0)}%</span>
              <span className="rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-700">المزوّد: {plan.provider}{plan.model ? ` · ${plan.model}` : ""}</span>
              {plan.preliminary && <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-700">تحليل أولي</span>}
            </div>
            <div className="mt-4">
              <div className="text-sm font-semibold text-gold">ملخص القضية</div>
              <p className="mt-1 leading-8 text-gray-900">{plan.caseSummary}</p>
            </div>
            <div className="mt-3">
              <div className="text-sm font-semibold text-gold">توصيف النزاع</div>
              <p className="mt-1 leading-8 text-gray-800">{plan.disputeCharacterization}</p>
            </div>
            <div className="mt-3">
              <div className="text-sm font-semibold text-gold">استراتيجية الدعوى</div>
              <p className="mt-1 leading-8 text-gray-800">{plan.litigationStrategy}</p>
            </div>
            <div className="mt-3 rounded-md bg-emerald-50 p-3">
              <div className="text-sm font-semibold text-emerald-800">التوصية العملية</div>
              <p className="mt-1 leading-8 text-emerald-900">{plan.practicalRecommendation}</p>
            </div>
          </div>

          {/* الدفوع المصنّفة */}
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="font-semibold text-olive">الدفوع المقترحة ({plan.suggestedDefenses.length})</div>
            {plan.suggestedDefenses.length === 0 ? (
              <p className="mt-2 text-sm text-gray-400">لا دفوع مقترحة.</p>
            ) : (
              <ul className="mt-2 space-y-2 text-sm">
                {plan.suggestedDefenses.map((d, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-2">
                    <span className="rounded bg-gold/10 px-1.5 py-0.5 text-xs text-gold">{DEFENSE_CATEGORY_LABELS[d.category]}</span>
                    <span className="text-gray-800">{d.text}</span>
                    {d.verified ? (
                      <span className="ms-auto rounded bg-emerald-50 px-1.5 py-0.5 text-xs text-emerald-700">مُسنَد{d.basis ? `: ${d.basis}` : ""}</span>
                    ) : (
                      <span className="ms-auto rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-700">{d.note}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <ListCard title="المسائل القانونية الرئيسية" items={plan.legalIssues} tone="olive" ordered />
            <ListCard title="خطة المرافعة" items={plan.pleadingPlan} tone="blue" ordered />
            <ListCard title="البيّنات المطلوبة" items={plan.requiredEvidence} tone="blue" />
            <ListCard title="الأسئلة المقترحة للخصم/الشهود" items={plan.suggestedQuestions} tone="olive" />
            <ListCard title="نقاط القوة" items={plan.strengths} tone="emerald" />
            <ListCard title="نقاط الضعف" items={plan.weaknesses} tone="red" />
            <ListCard title="المخاطر القانونية" items={plan.legalRisks} tone="amber" />
            <ListCard title="فرص النجاح" items={plan.successOpportunities} tone="emerald" />
            <ListCard title="الثغرات الواجب سدّها" items={plan.gapsToClose} tone="amber" />
          </div>

          <SourceGroup title="المواد النظامية المؤثّرة" items={plan.influentialArticles.map((a) => ({ id: a.id, title: a.title, sub: a.reference, weight: a.weight }))} type="article" />
          <SourceGroup title="الأحكام المشابهة" items={plan.similarRulings.map((r) => ({ id: r.id, title: r.title, sub: r.reason, weight: r.weight }))} type="ruling" />

          {/* الاستشهادات */}
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="font-semibold text-olive">الاستشهادات الكاملة ({plan.citations.length})</div>
            {plan.citations.length === 0 ? (
              <p className="mt-2 text-sm text-gray-400">لا استشهادات مُتحقَّقة — اعتمد التحفّظ أعلاه.</p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm">
                {plan.citations.map((c) => (
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
  olive: "text-olive",
  emerald: "text-emerald-700",
  blue: "text-blue-700",
  amber: "text-amber-700",
  red: "text-red-600",
};

function ListCard({ title, items, tone, ordered }: { title: string; items: string[]; tone: string; ordered?: boolean }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className={`font-semibold ${TONES[tone] ?? "text-olive"}`}>
        {title} ({items.length})
      </div>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-gray-400">—</p>
      ) : ordered ? (
        <ol className="mt-2 list-decimal space-y-1 pe-5 text-sm text-gray-800">
          {items.map((it, i) => (
            <li key={i} className="leading-7">{it}</li>
          ))}
        </ol>
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

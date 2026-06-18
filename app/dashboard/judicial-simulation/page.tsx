import { requirePagePermission } from "@/lib/modules/auth/session";
import { runJudicialSimulation } from "@/lib/modules/judicial-simulation/judicial-simulation";
import type { LitigationStage, SimulatedJudicialView } from "@/lib/modules/judicial-simulation/types";
import type { PartyRole } from "@/lib/modules/legal-agent/types";

export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<string, string> = { article: "مادة", ruling: "حكم", principle: "مبدأ" };

export default async function JudicialSimulationPage({
  searchParams,
}: {
  searchParams: {
    caseFacts?: string; claims?: string; defenses?: string; evidenceSummary?: string;
    partyRole?: string; jurisdiction?: string; caseType?: string; litigationStage?: string;
  };
}) {
  await requirePagePermission("LEGAL_CORE_VIEW");

  const caseFacts = (searchParams.caseFacts ?? "").trim();
  const claims = (searchParams.claims ?? "").trim();
  const defenses = (searchParams.defenses ?? "").trim();
  const evidenceSummary = (searchParams.evidenceSummary ?? "").trim();
  const jurisdiction = (searchParams.jurisdiction ?? "").trim();
  const caseType = (searchParams.caseType ?? "").trim();
  const partyRole = (searchParams.partyRole === "PLAINTIFF" || searchParams.partyRole === "DEFENDANT" ? searchParams.partyRole : undefined) as PartyRole | undefined;
  const litigationStage = (["FIRST_INSTANCE", "APPEAL", "CASSATION"].includes(searchParams.litigationStage ?? "") ? searchParams.litigationStage : undefined) as LitigationStage | undefined;

  let view: SimulatedJudicialView | null = null;
  let failed = false;
  if (caseFacts.length >= 10) {
    try {
      view = await runJudicialSimulation({ caseFacts, claims, defenses, evidenceSummary, partyRole, jurisdiction, caseType, litigationStage });
    } catch {
      failed = true;
    }
  }

  return (
    <div dir="rtl">
      <p className="text-sm font-semibold text-gold">المحاكاة القضائية</p>
      <h1 className="mt-2 text-3xl font-bold text-olive">محاكاة تفكير القاضي (اختبار)</h1>
      <p className="mt-3 max-w-3xl leading-8 text-gray-700">
        يحاكي حكيم نظر الدعوى من القبول الشكلي حتى تقدير الحكم المحتمل، بإسناد كامل عبر Citation Engine.
      </p>
      <div className="mt-3 rounded-md border border-red-300 bg-red-50 p-3 text-sm font-semibold text-red-700">
        ⚠ مخرجات هذه الصفحة تدريبية وتحليلية فقط، وليست حكماً قضائياً فعلياً ولا تُعتمد كحكم نهائي ملزم.
      </div>

      <form className="mt-6 grid gap-3" action="/dashboard/judicial-simulation">
        <textarea name="caseFacts" defaultValue={caseFacts} rows={4} placeholder="وقائع الدعوى (إلزامي، ١٠ أحرف فأكثر)..." className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        <div className="grid gap-3 md:grid-cols-4">
          <select name="partyRole" defaultValue={partyRole ?? ""} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
            <option value="">دور المستخدم…</option>
            <option value="PLAINTIFF">مدّعٍ</option>
            <option value="DEFENDANT">مدّعى عليه</option>
          </select>
          <input name="caseType" defaultValue={caseType} placeholder="نوع القضية (تجاري/تنفيذي…)" className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
          <select name="litigationStage" defaultValue={litigationStage ?? ""} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
            <option value="">المرحلة الإجرائية…</option>
            <option value="FIRST_INSTANCE">ابتدائي</option>
            <option value="APPEAL">استئناف</option>
            <option value="CASSATION">تمييز</option>
          </select>
          <input name="jurisdiction" defaultValue={jurisdiction} placeholder="جهة الاختصاص" className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <textarea name="claims" defaultValue={claims} rows={2} placeholder="طلبات المدعي (اختياري)..." className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
          <textarea name="defenses" defaultValue={defenses} rows={2} placeholder="دفوع المدعى عليه (اختياري)..." className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <textarea name="evidenceSummary" defaultValue={evidenceSummary} rows={2} placeholder="ملخّص البيّنات (اختياري)..." className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        <div>
          <button type="submit" className="rounded-md bg-olive px-6 py-2 text-sm text-white">محاكاة قضائية</button>
        </div>
      </form>

      {failed && (
        <div className="mt-6 rounded-md border border-amber-300 bg-amber-50 p-4 text-amber-800">
          ⚠ تعذّر تشغيل المحاكاة (قد تكون جداول/امتدادات القاعدة غير مُفعّلة محلياً بعد).
        </div>
      )}

      {view && (
        <div className="mt-6 space-y-5">
          <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm font-semibold text-red-700">⚠ {view.trainingDisclaimer}</div>
          {view.insufficientNote && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 font-semibold text-amber-800">⚠ {view.insufficientNote}</div>
          )}

          {/* الترويسة */}
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-semibold text-olive">الرؤية القضائية المُحاكاة</span>
              <span className="rounded bg-indigo-50 px-3 py-1 text-sm font-bold text-indigo-700 tabular-nums">تقدير قوة الدعوى {view.caseStrengthScore}/100</span>
              <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700 tabular-nums">الثقة {(view.confidence * 100).toFixed(0)}%</span>
              <span className="rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-700">المزوّد: {view.provider}{view.model ? ` · ${view.model}` : ""}</span>
              {!view.reliable && <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-700">غير موثوقة (نقص مصادر)</span>}
            </div>
            <Field label="ملخص الدعوى" value={view.caseSummary} />
            <Field label="التكييف القضائي الأولي" value={view.preliminaryCharacterization} />
            <Field label="الاختصاص المحتمل" value={view.probableJurisdiction} />
            <Field label="محل النزاع" value={view.disputeSubject} />
            <Field label="عبء الإثبات" value={view.burdenOfProof} />
          </div>

          {/* تقدير الحكم المحتمل */}
          <div className="rounded-lg border border-indigo-200 bg-indigo-50/40 p-5">
            <div className="font-semibold text-indigo-800">تقدير الحكم المحتمل (غير ملزم)</div>
            <Field label="الاتجاه القضائي المحتمل" value={view.probableDirection} />
            <Field label="المنطوق المحتمل" value={view.tentativeRuling} />
            <ListCard title="مسودة أسباب الحكم" items={view.draftReasoning} ordered tone="olive" />
            <Field label="تقدير موقف المدعي" value={view.plaintiffPosition} />
            <Field label="تقدير موقف المدعى عليه" value={view.defendantPosition} />
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <ListCard title="ملاحظات القبول الشكلي" items={view.admissibilityNotes} tone="blue" />
            <ListCard title="الدفوع التي يرجّح نظرها أولاً" items={view.defensesHeardFirst} tone="amber" />
            <ListCard title="الأسئلة القضائية المقترحة" items={view.judicialQuestions} tone="olive" />
            <ListCard title="القرارات الإجرائية المحتملة" items={view.proceduralDecisions} ordered tone="blue" />
            <ListCard title="الوقائع المنتِجة" items={view.materialFacts} tone="emerald" />
            <ListCard title="الوقائع غير المنتِجة" items={view.immaterialFacts} tone="gray" />
            <ListCard title="البيّنات المؤثّرة" items={view.influentialEvidence} tone="blue" />
            <ListCard title="نقاط تحتاج استيضاحاً" items={view.clarificationsNeeded} tone="amber" />
            <ListCard title="مخاطر الاستئناف" items={view.appealRisks} tone="red" />
            <ListCard title="نقاط قد تؤثّر في النقض/التأييد" items={view.cassationFactors} tone="amber" />
          </div>

          <SourceGroup title="المواد النظامية المؤثّرة" items={view.influentialArticles.map((a) => ({ id: a.id, title: a.title, sub: a.reference, weight: a.weight }))} type="article" />
          <SourceGroup title="الأحكام المشابهة" items={view.similarRulings.map((r) => ({ id: r.id, title: r.title, sub: r.reason, weight: r.weight }))} type="ruling" />

          {/* الاستشهادات */}
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="font-semibold text-olive">الاستشهادات الكاملة ({view.citations.length})</div>
            {view.citations.length === 0 ? (
              <p className="mt-2 text-sm text-gray-400">لا استشهادات مُتحقَّقة — اعتمد التحفّظ أعلاه.</p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm">
                {view.citations.map((c) => (
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

function Field({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="mt-3">
      <div className="text-sm font-semibold text-gold">{label}</div>
      <p className="mt-1 leading-8 text-gray-800">{value}</p>
    </div>
  );
}

const TONES: Record<string, string> = {
  olive: "text-olive",
  emerald: "text-emerald-700",
  gray: "text-gray-600",
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

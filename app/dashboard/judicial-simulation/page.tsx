import Link from "next/link";
import { Scale, Gavel } from "lucide-react";
import { requirePagePermission } from "@/lib/modules/auth/session";
import { runJudicialSimulation } from "@/lib/modules/judicial-simulation/judicial-simulation";
import { LegalPageHeader, LegalAlert } from "@/components/ui/legal";
import type { LitigationStage, SimulatedJudicialView } from "@/lib/modules/judicial-simulation/types";
import type { PartyRole } from "@/lib/modules/legal-agent/types";

export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<string, string> = { article: "مادة", ruling: "حكم", principle: "مبدأ" };

const inputCls =
  "w-full rounded-[var(--r-md)] border border-[var(--ink-20)] bg-white px-3 py-2 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold-ghost)]";

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
      <LegalPageHeader
        eyebrow="محاكاة قضائية ذكية"
        title="المحاكاة القضائية"
        description="يحاكي حكيم نظر الدعوى من القبول الشكلي حتى تقدير الحكم المحتمل — بإسنادٍ كامل لكل استنتاج عبر محرّك الاستشهاد من النواة القانونية."
        actions={
          <>
            <Link href="/dashboard/simulations" className="btn btn-gold">
              <Gavel size={16} /> القاضي التفاعلي (قاعة كاملة)
            </Link>
            <Link href="/dashboard/legal-core/objection-methods" className="btn ho-hero-outline">
              <Scale size={16} /> دليل طرق الاعتراض
            </Link>
          </>
        }
      />

      <div className="mt-6">
        <LegalAlert tone="warning">
          مخرجات المحاكاة <strong>تدريبية وتحليلية</strong> تساعدك على فهم اتجاهات النظر القضائي المحتملة — وليست حكماً قضائياً فعلياً ولا تُعتمد كحكم نهائي ملزم.
        </LegalAlert>
      </div>

      <form className="card mt-6 grid gap-3" action="/dashboard/judicial-simulation">
        <textarea name="caseFacts" defaultValue={caseFacts} rows={4} placeholder="وقائع الدعوى (إلزامي، ١٠ أحرف فأكثر)..." className={inputCls} />
        <div className="grid gap-3 md:grid-cols-4">
          <select name="partyRole" defaultValue={partyRole ?? ""} className={inputCls}>
            <option value="">دور المستخدم…</option>
            <option value="PLAINTIFF">مدّعٍ</option>
            <option value="DEFENDANT">مدّعى عليه</option>
          </select>
          <input name="caseType" defaultValue={caseType} placeholder="نوع القضية (تجاري/تنفيذي…)" className={inputCls} />
          <select name="litigationStage" defaultValue={litigationStage ?? ""} className={inputCls}>
            <option value="">المرحلة الإجرائية…</option>
            <option value="FIRST_INSTANCE">ابتدائي</option>
            <option value="APPEAL">استئناف</option>
            <option value="CASSATION">تمييز</option>
          </select>
          <input name="jurisdiction" defaultValue={jurisdiction} placeholder="جهة الاختصاص" className={inputCls} />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <textarea name="claims" defaultValue={claims} rows={2} placeholder="طلبات المدعي (اختياري)..." className={inputCls} />
          <textarea name="defenses" defaultValue={defenses} rows={2} placeholder="دفوع المدعى عليه (اختياري)..." className={inputCls} />
        </div>
        <textarea name="evidenceSummary" defaultValue={evidenceSummary} rows={2} placeholder="ملخّص البيّنات (اختياري)..." className={inputCls} />
        <div>
          <button type="submit" className="btn btn-gold">
            <Gavel size={16} /> ابدأ المحاكاة القضائية
          </button>
        </div>
      </form>

      {failed && (
        <div className="mt-6">
          <LegalAlert tone="danger">
            تعذّر تشغيل المحاكاة (قد تكون جداول/امتدادات القاعدة غير مُفعّلة محلياً بعد).
          </LegalAlert>
        </div>
      )}

      {view && (
        <div className="mt-6 space-y-5">
          <LegalAlert tone="warning">{view.trainingDisclaimer}</LegalAlert>
          {view.insufficientNote && <LegalAlert tone="warning">{view.insufficientNote}</LegalAlert>}

          {/* الترويسة */}
          <div className="card">
            <div className="flex flex-wrap items-center gap-3">
              <span className="t-display font-bold text-[var(--navy)]">الرؤية القضائية المُحاكاة</span>
              <span className="rounded-full bg-[var(--navy)] px-3 py-1 text-sm font-bold text-white tabular-nums">تقدير قوة الدعوى {view.caseStrengthScore}/100</span>
              <span className="rounded-full border border-[rgba(26,92,65,.25)] bg-[var(--emerald-soft)] px-2.5 py-0.5 text-xs font-semibold text-[var(--emerald)] tabular-nums">الثقة {(view.confidence * 100).toFixed(0)}%</span>
              <span className="rounded-full border border-[var(--gold-border)] bg-[var(--gold-ghost)] px-2.5 py-0.5 text-xs text-[var(--navy)]">المزوّد: {view.provider}{view.model ? ` · ${view.model}` : ""}</span>
              {!view.reliable && <span className="rounded-full border border-[rgba(184,114,26,.25)] bg-[var(--amber-soft)] px-2.5 py-0.5 text-xs font-semibold text-[var(--amber)]">غير موثوقة (نقص مصادر)</span>}
            </div>
            <Field label="ملخص الدعوى" value={view.caseSummary} />
            <Field label="التكييف القضائي الأولي" value={view.preliminaryCharacterization} />
            <Field label="الاختصاص المحتمل" value={view.probableJurisdiction} />
            <Field label="محل النزاع" value={view.disputeSubject} />
            <Field label="عبء الإثبات" value={view.burdenOfProof} />
          </div>

          {/* تقدير الحكم المحتمل */}
          <div className="card border-r-4" style={{ borderRightColor: "var(--gold)" }}>
            <div className="t-display font-bold text-[var(--gold-dark)]">تقدير الحكم المحتمل (غير ملزم)</div>
            <Field label="الاتجاه القضائي المحتمل" value={view.probableDirection} />
            <Field label="المنطوق المحتمل" value={view.tentativeRuling} />
            <div className="mt-3"><ListCard title="مسودة أسباب الحكم" items={view.draftReasoning} ordered tone="navy" /></div>
            <Field label="تقدير موقف المدعي" value={view.plaintiffPosition} />
            <Field label="تقدير موقف المدعى عليه" value={view.defendantPosition} />
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <ListCard title="ملاحظات القبول الشكلي" items={view.admissibilityNotes} tone="navy" />
            <ListCard title="الدفوع التي يرجّح نظرها أولاً" items={view.defensesHeardFirst} tone="amber" />
            <ListCard title="الأسئلة القضائية المقترحة" items={view.judicialQuestions} tone="navy" />
            <ListCard title="القرارات الإجرائية المحتملة" items={view.proceduralDecisions} ordered tone="navy" />
            <ListCard title="الوقائع المنتِجة" items={view.materialFacts} tone="emerald" />
            <ListCard title="الوقائع غير المنتِجة" items={view.immaterialFacts} tone="ink" />
            <ListCard title="البيّنات المؤثّرة" items={view.influentialEvidence} tone="navy" />
            <ListCard title="نقاط تحتاج استيضاحاً" items={view.clarificationsNeeded} tone="amber" />
            <ListCard title="مخاطر الاستئناف" items={view.appealRisks} tone="ruby" />
            <ListCard title="نقاط قد تؤثّر في النقض/التأييد" items={view.cassationFactors} tone="amber" />
          </div>

          <SourceGroup title="المواد النظامية المؤثّرة" items={view.influentialArticles.map((a) => ({ id: a.id, title: a.title, sub: a.reference, weight: a.weight }))} type="article" />
          <SourceGroup title="الأحكام المشابهة" items={view.similarRulings.map((r) => ({ id: r.id, title: r.title, sub: r.reason, weight: r.weight }))} type="ruling" />

          {/* الاستشهادات */}
          <div className="card">
            <div className="t-display font-bold text-[var(--navy)]">الاستشهادات الكاملة ({view.citations.length})</div>
            {view.citations.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--ink-40)]">لا استشهادات مُتحقَّقة — اعتمد التحفّظ أعلاه.</p>
            ) : (
              <ul className="mt-3 space-y-1 text-sm">
                {view.citations.map((c) => (
                  <li key={`${c.sourceType}:${c.sourceId}`} className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-[var(--gold-ghost)] px-1.5 py-0.5 text-xs text-[var(--gold-dark)]">{TYPE_LABELS[c.sourceType]}</span>
                    <span className="text-[var(--ink-80)]">{c.reference}</span>
                    <span className="ms-auto text-xs text-[var(--ink-40)] tabular-nums">ثقة {(c.confidence * 100).toFixed(0)}%</span>
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
      <div className="text-sm font-semibold text-[var(--gold-dark)]">{label}</div>
      <p className="mt-1 leading-8 text-[var(--ink-80)]">{value}</p>
    </div>
  );
}

const TONES: Record<string, string> = {
  navy: "text-[var(--navy)]",
  emerald: "text-[var(--emerald)]",
  amber: "text-[var(--amber)]",
  ruby: "text-[var(--ruby)]",
  ink: "text-[var(--ink-60)]",
};

function ListCard({ title, items, tone, ordered }: { title: string; items: string[]; tone: string; ordered?: boolean }) {
  return (
    <div className="card">
      <div className={`t-display font-bold ${TONES[tone] ?? "text-[var(--navy)]"}`}>
        {title} ({items.length})
      </div>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--ink-40)]">—</p>
      ) : ordered ? (
        <ol className="mt-2 list-decimal space-y-1 pe-5 text-sm text-[var(--ink-80)]">
          {items.map((it, i) => (
            <li key={i} className="leading-7">{it}</li>
          ))}
        </ol>
      ) : (
        <ul className="mt-2 list-disc space-y-1 pe-5 text-sm text-[var(--ink-80)]">
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
    <div className="card">
      <div className="t-display font-bold text-[var(--navy)]">
        {title} ({items.length})
      </div>
      <ul className="mt-3 space-y-2 text-sm">
        {items.map((it) => (
          <li key={it.id} className="border-t border-[var(--ink-08)] pt-2">
            <div className="flex items-center gap-2">
              <span className="rounded bg-[var(--gold-ghost)] px-1.5 py-0.5 text-xs text-[var(--gold-dark)]">{TYPE_LABELS[type]}</span>
              <span className="text-[var(--ink-80)]">{it.title}</span>
              <span className="ms-auto text-xs text-[var(--ink-40)] tabular-nums">{(it.weight * 100).toFixed(0)}%</span>
            </div>
            <div className="mt-1 text-xs text-[var(--ink-60)]">{it.sub}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}

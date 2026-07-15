import Link from "next/link";
import { Scale, Gavel } from "lucide-react";
import { requirePagePermission } from "@/lib/modules/auth/session";
import { runLegalAgent } from "@/lib/modules/legal-agent/legal-agent";
import { DEFENSE_CATEGORY_LABELS } from "@/lib/modules/case-analysis/defense-classifier";
import { LegalPageHeader, LegalAlert } from "@/components/ui/legal";
import { AiToolTabs } from "@/components/ai/AiToolTabs";
import type { LegalActionPlan, PartyRole } from "@/lib/modules/legal-agent/types";

export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<string, string> = { article: "مادة", ruling: "حكم", principle: "مبدأ" };

const inputCls =
  "w-full rounded-[var(--r-md)] border border-[var(--ink-20)] bg-white px-3 py-2 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold-ghost)]";

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
      <LegalPageHeader
        eyebrow="الوكيل القانوني"
        title="خطة عمل قانونية للمحامي"
        description="يحوّل الوكيل تحليل القضية (فوق Legal RAG) إلى خطة عملية: استراتيجية، دفوع مصنّفة، بيّنات، مخاطر، فرص نجاح، خطة مرافعة، وأسئلة وتوصية — باستشهادات حقيقية فقط، ومع تحفّظ صريح عند نقص المصادر."
        actions={
          <>
            <Link href="/dashboard/case-analysis" className="btn btn-gold">
              <Scale size={16} /> تحليل القضية
            </Link>
            <Link href="/dashboard/judicial-simulation" className="btn ho-hero-outline">
              <Gavel size={16} /> المحاكاة القضائية
            </Link>
          </>
        }
      />

      <AiToolTabs active="legal-agent" />

      <form className="card mt-6 grid gap-3" action="/dashboard/legal-agent">
        <textarea name="caseFacts" aria-label="وقائع الدعوى" defaultValue={caseFacts} rows={4} placeholder="وقائع الدعوى (إلزامي، ١٠ أحرف فأكثر)..." className={inputCls} />
        <div className="grid gap-3 md:grid-cols-3">
          <select name="partyRole" aria-label="صفة الطرف" defaultValue={partyRole ?? ""} className={inputCls}>
            <option value="">دور الموكِّل…</option>
            <option value="PLAINTIFF">مدّعٍ</option>
            <option value="DEFENDANT">مدّعى عليه</option>
          </select>
          <input name="caseType" aria-label="نوع القضية" defaultValue={caseType} placeholder="نوع القضية (تجاري/تنفيذي…)" className={inputCls} />
          <input name="jurisdiction" aria-label="جهة الاختصاص" defaultValue={jurisdiction} placeholder="جهة الاختصاص (المحكمة)" className={inputCls} />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <textarea name="claims" aria-label="طلبات المدعي" defaultValue={claims} rows={2} placeholder="طلبات المدعي (اختياري)..." className={inputCls} />
          <textarea name="defenses" aria-label="دفوع الخصم" defaultValue={defenses} rows={2} placeholder="دفوع الخصم (اختياري)..." className={inputCls} />
        </div>
        <textarea name="documents" aria-label="المستندات" defaultValue={documents.join("\n")} rows={2} placeholder="المستندات (سطر لكل مستند، اختياري)..." className={inputCls} />
        <div>
          <button type="submit" className="btn btn-gold">
            <Scale size={16} /> حلّل وخطّط
          </button>
        </div>
      </form>

      {failed && (
        <div className="mt-6">
          <LegalAlert tone="danger">
            تعذّر تشغيل الوكيل (قد تكون جداول/امتدادات القاعدة غير مُفعّلة محلياً بعد).
          </LegalAlert>
        </div>
      )}

      {plan && (
        <div className="mt-6 space-y-5">
          {plan.preliminary && plan.disclaimer && <LegalAlert tone="warning">{plan.disclaimer}</LegalAlert>}

          {/* الترويسة */}
          <div className="card">
            <div className="flex flex-wrap items-center gap-3">
              <span className="t-display font-bold text-[var(--navy)]">التقدير العام</span>
              <span className="rounded-full bg-[var(--navy)] px-3 py-1 text-sm font-bold text-white tabular-nums">قوة الدعوى {plan.caseStrengthScore}/100</span>
              <span className="rounded-full border border-[rgba(26,92,65,.25)] bg-[var(--emerald-soft)] px-2.5 py-0.5 text-xs font-semibold text-[var(--emerald)] tabular-nums">الثقة {(plan.confidence * 100).toFixed(0)}%</span>
              <span className="rounded-full border border-[var(--gold-border)] bg-[var(--gold-ghost)] px-2.5 py-0.5 text-xs text-[var(--navy)]">المزوّد: {plan.provider}{plan.model ? ` · ${plan.model}` : ""}</span>
              {plan.preliminary && <span className="rounded-full border border-[rgba(184,114,26,.25)] bg-[var(--amber-soft)] px-2.5 py-0.5 text-xs font-semibold text-[var(--amber)]">تحليل أولي</span>}
            </div>
            <Field label="ملخص القضية" value={plan.caseSummary} />
            <Field label="توصيف النزاع" value={plan.disputeCharacterization} />
            <Field label="استراتيجية الدعوى" value={plan.litigationStrategy} />
            <div className="mt-4 rounded-[var(--r-md)] border border-[rgba(26,92,65,.25)] bg-[var(--emerald-soft)] p-3">
              <div className="text-sm font-semibold text-[var(--emerald)]">التوصية العملية</div>
              <p className="mt-1 leading-8 text-[var(--ink-80)]">{plan.practicalRecommendation}</p>
            </div>
          </div>

          {/* الدفوع المصنّفة */}
          <div className="card">
            <div className="t-display font-bold text-[var(--navy)]">الدفوع المقترحة ({plan.suggestedDefenses.length})</div>
            {plan.suggestedDefenses.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--ink-40)]">لا دفوع مقترحة.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {plan.suggestedDefenses.map((d, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-2 border-t border-[var(--ink-08)] pt-2">
                    <span className="rounded bg-[var(--gold-ghost)] px-1.5 py-0.5 text-xs text-[var(--gold-dark)]">{DEFENSE_CATEGORY_LABELS[d.category]}</span>
                    <span className="text-[var(--ink-80)]">{d.text}</span>
                    {d.verified ? (
                      <span className="ms-auto rounded border border-[rgba(26,92,65,.25)] bg-[var(--emerald-soft)] px-1.5 py-0.5 text-xs text-[var(--emerald)]">مُسنَد{d.basis ? `: ${d.basis}` : ""}</span>
                    ) : (
                      <span className="ms-auto rounded border border-[rgba(184,114,26,.25)] bg-[var(--amber-soft)] px-1.5 py-0.5 text-xs text-[var(--amber)]">{d.note}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <ListCard title="المسائل القانونية الرئيسية" items={plan.legalIssues} tone="navy" ordered />
            <ListCard title="خطة المرافعة" items={plan.pleadingPlan} tone="navy" ordered />
            <ListCard title="البيّنات المطلوبة" items={plan.requiredEvidence} tone="navy" />
            <ListCard title="الأسئلة المقترحة للخصم/الشهود" items={plan.suggestedQuestions} tone="navy" />
            <ListCard title="نقاط القوة" items={plan.strengths} tone="emerald" />
            <ListCard title="نقاط الضعف" items={plan.weaknesses} tone="ruby" />
            <ListCard title="المخاطر القانونية" items={plan.legalRisks} tone="amber" />
            <ListCard title="فرص النجاح" items={plan.successOpportunities} tone="emerald" />
            <ListCard title="الثغرات الواجب سدّها" items={plan.gapsToClose} tone="amber" />
          </div>

          <SourceGroup title="المواد النظامية المؤثّرة" items={plan.influentialArticles.map((a) => ({ id: a.id, title: a.title, sub: a.reference, weight: a.weight }))} type="article" />
          <SourceGroup title="الأحكام المشابهة" items={plan.similarRulings.map((r) => ({ id: r.id, title: r.title, sub: r.reason, weight: r.weight }))} type="ruling" />

          {/* الاستشهادات */}
          <div className="card">
            <div className="t-display font-bold text-[var(--navy)]">الاستشهادات الكاملة ({plan.citations.length})</div>
            {plan.citations.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--ink-40)]">لا استشهادات مُتحقَّقة — اعتمد التحفّظ أعلاه.</p>
            ) : (
              <ul className="mt-3 space-y-1 text-sm">
                {plan.citations.map((c) => (
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

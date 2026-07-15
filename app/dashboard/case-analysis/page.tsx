import Link from "next/link";
import { Scale, Gavel } from "lucide-react";
import { requirePagePermission } from "@/lib/modules/auth/session";
import { analyzeCase } from "@/lib/modules/case-analysis/case-analysis-engine";
import { DEFENSE_CATEGORY_LABELS } from "@/lib/modules/case-analysis/defense-classifier";
import { LegalPageHeader, LegalAlert } from "@/components/ui/legal";
import { AiToolTabs } from "@/components/ai/AiToolTabs";
import type { CaseAnalysisResult } from "@/lib/modules/case-analysis/types";

export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<string, string> = { article: "مادة", ruling: "حكم", principle: "مبدأ" };

const inputCls =
  "w-full rounded-[var(--r-md)] border border-[var(--ink-20)] bg-white px-3 py-2 text-sm text-[var(--ink)] outline-none transition focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold-ghost)]";

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

  // إبطال الـno-op الصامت: إدخال أقصر من الحدّ يعرض تنبيهًا بدل إعادة تحميل صامتة.
  const tooShort = facts.length > 0 && facts.length < 10;
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
      <LegalPageHeader
        eyebrow="محرّك تحليل القضايا"
        title="تحليل قانوني مُسنَد للدعوى"
        description="يبني التحليل فوق الذكاء القانوني (Legal RAG): توصيف النزاع، الوقائع المنتِجة، عبء الإثبات، الدفوع المصنّفة، المخاطر، نقاط القوة والضعف، والمواد والأحكام المؤثّرة — مع تقدير أوّلي لقوة الدعوى وإسناد كامل."
        actions={
          <>
            <Link href="/dashboard/legal-agent" className="btn btn-gold">
              <Scale size={16} /> الوكيل القانوني (خطة عمل)
            </Link>
            <Link href="/dashboard/judicial-simulation" className="btn ho-hero-outline">
              <Gavel size={16} /> المحاكاة القضائية
            </Link>
          </>
        }
      />

      <AiToolTabs active="case-analysis" />

      <form className="card mt-6 grid gap-3" action="/dashboard/case-analysis">
        <textarea name="facts" aria-label="وقائع الدعوى" defaultValue={facts} rows={4} placeholder="وقائع الدعوى (إلزامي، ١٠ أحرف فأكثر)..." className={inputCls} />
        <div className="grid gap-3 md:grid-cols-2">
          <textarea name="claims" aria-label="طلبات المدعي" defaultValue={claims} rows={2} placeholder="طلبات المدعي (اختياري)..." className={inputCls} />
          <textarea name="defenses" aria-label="دفوع المدعى عليه" defaultValue={defenses} rows={2} placeholder="دفوع المدعى عليه (اختياري)..." className={inputCls} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input name="caseType" aria-label="نوع القضية" defaultValue={caseType} placeholder="نوع القضية (تجاري/عمالي/مدني...)" className={`${inputCls} min-w-[220px] flex-1`} />
          <button type="submit" className="btn btn-gold">
            <Scale size={16} /> حلّل القضية
          </button>
        </div>
      </form>

      {tooShort && (
        <div className="mt-6">
          <LegalAlert tone="warning">وقائع الدعوى قصيرة جدًا — اكتب ١٠ أحرف فأكثر لبدء التحليل.</LegalAlert>
        </div>
      )}

      {failed && (
        <div className="mt-6">
          <LegalAlert tone="danger">
            تعذّر تشغيل المحرّك (قد تكون جداول/امتدادات القاعدة غير مُفعّلة محلياً بعد).
          </LegalAlert>
        </div>
      )}

      {result && (
        <div className="mt-6 space-y-5">
          {/* الترويسة: قوة الدعوى + الثقة + المزوّد */}
          <div className="card">
            <div className="flex flex-wrap items-center gap-3">
              <span className="t-display font-bold text-[var(--navy)]">التقدير العام</span>
              <span className="rounded-full bg-[var(--navy)] px-3 py-1 text-sm font-bold text-white tabular-nums">قوة الدعوى {result.caseStrengthScore}/100</span>
              <span className="rounded-full border border-[rgba(26,92,65,.25)] bg-[var(--emerald-soft)] px-2.5 py-0.5 text-xs font-semibold text-[var(--emerald)] tabular-nums">ثقة الإسناد {(result.confidence * 100).toFixed(0)}%</span>
              <span className="rounded-full border border-[var(--gold-border)] bg-[var(--gold-ghost)] px-2.5 py-0.5 text-xs text-[var(--navy)]">المزوّد: {result.provider}{result.model ? ` · ${result.model}` : ""}</span>
              {!result.grounded && <span className="rounded-full border border-[rgba(140,34,51,.25)] bg-[var(--ruby-soft)] px-2.5 py-0.5 text-xs font-semibold text-[var(--ruby)]">إسناد محدود</span>}
            </div>
            <Field label="توصيف النزاع قانونياً" value={result.disputeCharacterization} />
            <Field label="عبء الإثبات" value={result.burdenOfProof} />
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <ListCard title="الوقائع المنتِجة" items={result.materialFacts} tone="emerald" />
            <ListCard title="الوقائع غير المنتِجة" items={result.immaterialFacts} tone="ink" />
            <ListCard title="عناصر الإثبات المطلوبة" items={result.requiredEvidence} tone="navy" />
            <ListCard title="المخاطر القانونية" items={result.legalRisks} tone="amber" />
            <ListCard title="نقاط القوة" items={result.strengths} tone="emerald" />
            <ListCard title="نقاط الضعف" items={result.weaknesses} tone="ruby" />
          </div>

          {/* الدفوع المحتملة مصنّفة */}
          <div className="card">
            <div className="t-display font-bold text-[var(--navy)]">الدفوع المحتملة ({result.potentialDefenses.length})</div>
            {result.potentialDefenses.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--ink-40)]">لا دفوع مقترحة.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {result.potentialDefenses.map((d, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-2 border-t border-[var(--ink-08)] pt-2">
                    <span className="rounded bg-[var(--gold-ghost)] px-1.5 py-0.5 text-xs text-[var(--gold-dark)]">{DEFENSE_CATEGORY_LABELS[d.category]}</span>
                    <span className="text-[var(--ink-80)]">{d.text}</span>
                    {d.basis && <span className="ms-auto text-xs text-[var(--ink-40)]">السند: {d.basis}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <SourceGroup title="المواد النظامية المؤثّرة" items={result.influentialArticles.map((a) => ({ id: a.id, title: a.title, sub: a.reference, weight: a.weight }))} type="article" />
          <SourceGroup title="الأحكام المشابهة" items={result.similarRulings.map((r) => ({ id: r.id, title: r.title, sub: r.reason, weight: r.weight }))} type="ruling" />

          {/* الاستشهادات الكاملة */}
          <div className="card">
            <div className="t-display font-bold text-[var(--navy)]">الاستشهادات الكاملة ({result.citations.length})</div>
            {result.citations.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--ink-40)]">لا استشهادات مُتحقَّقة.</p>
            ) : (
              <ul className="mt-3 space-y-1 text-sm">
                {result.citations.map((c) => (
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

function ListCard({ title, items, tone }: { title: string; items: string[]; tone: string }) {
  return (
    <div className="card">
      <div className={`t-display font-bold ${TONES[tone] ?? "text-[var(--navy)]"}`}>
        {title} ({items.length})
      </div>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--ink-40)]">—</p>
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

/**
 * مكوّنات الذكاء القانوني المُسنَد — عرضية صِرفة (بلا hooks) تعمل داخل Server Components.
 *
 *  - LegalSourceBadge   شارة نوع المصدر / نوع المطابقة (معجمي/دلالي/هجين)
 *  - GroundingWarning   تنبيهات الإسناد: لا مصادر كافية / لا نصّ صريح / غير مُسنَد
 *  - LegalCitationBox   صندوق الاستشهاد: الأساس النظامي (نظام + مادة + مقتطف + سبب الصلة)
 *  - RelatedJudgmentsList  الأحكام المرتبطة (سوابق مؤيِّدة لا أساس نظامي)
 *
 * تصميم متحفّظ متوافق مع باقي الواجهة (RTL، ألوان gold/olive). لا تغيّر سلوك أي صفحة.
 */
import type { ReactNode } from "react";

// ── أنواع مدخلات خفيفة (متوافقة مع مخرجات RagResult دون اقترانٍ صلب) ──
export interface CitationView {
  sourceType: "article" | "ruling" | "principle";
  sourceId: string;
  title: string;
  reference: string;
  confidence: number;
}
export interface LegalBasisView {
  id: string;
  title: string;
  reference: string;
  weight: number;
  excerpt?: string;
  relevanceReason?: string;
}
export interface RelatedJudgmentView {
  id: string;
  title: string;
  reason: string;
  weight: number;
}

const SOURCE_LABELS: Record<string, string> = {
  article: "مادة",
  ruling: "حكم",
  principle: "مبدأ",
  lexical: "تطابق نصّي",
  semantic: "تطابق دلالي",
  hybrid: "هجين",
};

/** شارة صغيرة لنوع المصدر أو نوع المطابقة. */
export function LegalSourceBadge({ kind, className = "" }: { kind: string; className?: string }) {
  const label = SOURCE_LABELS[kind] ?? kind;
  return (
    <span className={`inline-flex items-center rounded bg-gold/10 px-1.5 py-0.5 text-xs font-semibold text-gold ${className}`}>
      {label}
    </span>
  );
}

/**
 * تنبيه حالة الإسناد. يعرض رسالة واضحة حسب الحالة دون كسر الصفحة:
 *  - insufficient: لا توجد مصادر كافية (الحارس منع الإجابة)
 *  - noExplicitText: توجد مصادر لكن بلا نصّ نظامي صريح
 *  - fallback: مُسنَد لكن لم يُولَّد نصّ من مزوّد الذكاء
 */
export function GroundingWarning({
  grounded,
  generated = true,
  legalBasisNote,
  message,
}: {
  grounded: boolean;
  generated?: boolean;
  legalBasisNote?: string | null;
  message?: string;
}) {
  if (!grounded) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm leading-7 text-red-700" role="alert">
        ⚠ {message || "لا توجد مصادر قانونية كافية للإجابة بثقة."}
      </div>
    );
  }
  return (
    <>
      {legalBasisNote ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm leading-7 text-amber-800">
          ⚠ {legalBasisNote}
        </div>
      ) : null}
      {!generated ? (
        <div className="rounded-md border border-gray-200 bg-surface p-3 text-xs leading-6 text-muted">
          عُرضت المصادر القانونية أدناه دون توليد نصّ من مزوّد الذكاء (سقوط منظّم).
        </div>
      ) : null}
    </>
  );
}

/**
 * صندوق الاستشهاد: الأساس النظامي (مواد حقيقية) + الاستشهادات المتحقّقة.
 * عند غياب الأساس النظامي يعرض رسالة «لا يوجد نص صريح» بدل اختلاق سند.
 */
export function LegalCitationBox({
  legalBasis,
  citations,
  legalBasisNote,
  emptyMessage = "لا يوجد نص صريح في المصادر المتاحة.",
  children,
}: {
  legalBasis: LegalBasisView[];
  citations?: CitationView[];
  legalBasisNote?: string | null;
  emptyMessage?: string;
  children?: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-gray-200 bg-ivory p-5" aria-label="الأساس النظامي" dir="rtl">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
        <h3 className="font-semibold text-olive">الأساس النظامي والاستشهادات</h3>
        <LegalSourceBadge kind="article" />
      </header>

      {legalBasis.length ? (
        <ul className="mt-4 space-y-3">
          {legalBasis.map((item) => (
            <li key={item.id} className="rounded-md border border-gray-100 bg-surface/60 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-mono-legal text-sm text-ink">{item.reference}</p>
                <span className="text-xs tabular-nums text-muted">{(item.weight * 100).toFixed(0)}%</span>
              </div>
              {item.title ? <p className="mt-1 text-sm font-semibold text-ink">{item.title}</p> : null}
              {item.excerpt ? (
                <p className="mt-2 rounded bg-ivory p-2 text-sm leading-7 text-ink">{item.excerpt}</p>
              ) : null}
              {item.relevanceReason ? (
                <p className="mt-1 text-xs text-muted">سبب الصلة: {item.relevanceReason}</p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 rounded-md border border-dashed border-gray-200 bg-surface p-4 text-center text-sm leading-7 text-muted">
          {legalBasisNote || emptyMessage}
        </p>
      )}

      {citations && citations.length ? (
        <div className="mt-4 border-t border-gray-100 pt-3">
          <div className="text-xs font-semibold text-muted">الاستشهادات المتحقّقة ({citations.length})</div>
          <ul className="mt-2 space-y-1 text-sm">
            {citations.map((c) => (
              <li key={`${c.sourceType}:${c.sourceId}`} className="flex flex-wrap items-center gap-2">
                <LegalSourceBadge kind={c.sourceType} />
                <span className="text-ink">{c.reference}</span>
                <span className="ms-auto text-xs tabular-nums text-muted">{(c.confidence * 100).toFixed(0)}%</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {children}
    </section>
  );
}

/**
 * قائمة الأحكام المرتبطة بالمادة. تُعرض كسوابق مؤيِّدة للاتجاه القضائي،
 * وليست بديلاً عن النصّ النظامي (تنويه صريح في الترويسة).
 */
export function RelatedJudgmentsList({
  items,
  title = "أحكام مرتبطة",
}: {
  items: RelatedJudgmentView[];
  title?: string;
}) {
  if (!items.length) return null;
  return (
    <section className="rounded-lg border border-gray-200 bg-ivory p-4" aria-label={title} dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-olive">
          {title} ({items.length})
        </h3>
        <span className="text-[11px] text-muted">سوابق مؤيِّدة للاتجاه القضائي — ليست أساساً نظامياً</span>
      </div>
      <ul className="mt-3 space-y-2 text-sm">
        {items.map((it) => (
          <li key={it.id} className="border-t border-gray-100 pt-2">
            <div className="flex items-center gap-2">
              <LegalSourceBadge kind="ruling" />
              <span className="text-ink">{it.title}</span>
              <span className="ms-auto text-xs tabular-nums text-muted">{(it.weight * 100).toFixed(0)}%</span>
            </div>
            <div className="mt-1 text-xs text-muted">سبب الظهور: {it.reason}</div>
          </li>
        ))}
      </ul>
    </section>
  );
}

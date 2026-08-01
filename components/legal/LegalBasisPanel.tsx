import type { ReactNode } from "react";
import Link from "next/link";
import { resolveEnforcement } from "@/lib/modules/agents/substrate/enforcement";

/**
 * LegalBasisPanel — لوحة «الأساس النظامي» بحالات التوثيق.
 *
 * سياسة حكيم: لا نِسب ثقة رقمية في المخرجات القانونية، بل حالات توثيق صريحة:
 *  - official      موثّق رسميًا            (مطابَق بمادة قائمة في النواة)
 *  - auto          مسترجع آليًا — يحتاج مراجعة (استرجاع تلقائي لم يُراجَع بشريًا)
 *  - unverified    غير موثّق               (لم يثبت وجوده في النواة)
 *  - insufficient  لا يوجد سند كافٍ        (لا توجد مادة داعمة)
 *
 * مكوّن عرضي صِرف (بدون hooks) كي يعمل داخل Server Components.
 */

export type DocumentationState = "official" | "auto" | "unverified" | "insufficient";

export type LegalBasisItem = {
  /** اسم النظام/المصدر */
  systemName: string;
  /** رقم المادة (اختياري عند insufficient) */
  articleNumber?: number | string;
  /** عنوان المادة */
  articleTitle?: string;
  /** نص المادة أو الاقتباس */
  quote?: string;
  /** حالة التوثيق لهذا السند */
  state: DocumentationState;
  /** رابط داخلي لفتح المادة في النواة */
  internalUrl?: string;
  /** المرحلة ٦: حالة النفاذ الخام (status) لعرض شارة ساري/لاغٍ/معدّل بجانب التوثيق. */
  enforcement?: string | null;
};

// المرحلة ٦: شارة النفاذ الزمنيّ — تُعرض بجانب حالة التوثيق كي يرى المحامي أن السند ساري لا لاغٍ.
const ENFORCEMENT_META: Record<string, { fg: string; bg: string; border: string; icon: string }> = {
  "ساري": { fg: "var(--emerald)", bg: "var(--emerald-soft)", border: "rgba(26,92,65,0.30)", icon: "✓" },
  "لاغٍ": { fg: "var(--ruby)", bg: "var(--ruby-soft)", border: "rgba(140,34,51,0.30)", icon: "⊘" },
  "معدّل": { fg: "var(--amber)", bg: "var(--amber-soft)", border: "rgba(184,114,26,0.30)", icon: "✎" },
  "موقوف": { fg: "var(--amber)", bg: "var(--amber-soft)", border: "rgba(184,114,26,0.30)", icon: "⏸" },
};

export function EnforcementBadge({ status }: { status?: string | null }) {
  const { state } = resolveEnforcement(status);
  const meta = ENFORCEMENT_META[state];
  if (!meta) return null; // غير_معروف → لا شارة (تفادي التضليل)
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{ color: meta.fg, background: meta.bg, border: `1px solid ${meta.border}` }}
      title={`حالة النفاذ: ${state}`}
    >
      <span aria-hidden>{meta.icon}</span>
      {state}
    </span>
  );
}

type StateMeta = {
  label: string;
  icon: string;
  fg: string;
  bg: string;
  border: string;
};

const STATE_META: Record<DocumentationState, StateMeta> = {
  official: {
    label: "موثّق رسميًا",
    icon: "🔗",
    fg: "var(--emerald)",
    bg: "var(--emerald-soft)",
    border: "rgba(26,92,65,0.30)"
  },
  auto: {
    label: "مسترجع آليًا — يحتاج مراجعة",
    icon: "⚠",
    fg: "var(--amber)",
    bg: "var(--amber-soft)",
    border: "rgba(184,114,26,0.30)"
  },
  unverified: {
    label: "غير موثّق",
    icon: "⏳",
    fg: "var(--ruby)",
    bg: "var(--ruby-soft)",
    border: "rgba(140,34,51,0.30)"
  },
  insufficient: {
    label: "لا يوجد سند كافٍ",
    icon: "—",
    fg: "var(--ink-60)",
    bg: "var(--ink-04)",
    border: "var(--ink-15)"
  }
};

export function DocumentationBadge({ state, className = "" }: { state: DocumentationState; className?: string }) {
  const meta = STATE_META[state];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${className}`}
      style={{ color: meta.fg, background: meta.bg, border: `1px solid ${meta.border}` }}
    >
      <span aria-hidden>{meta.icon}</span>
      {meta.label}
    </span>
  );
}

/** الحالة الإجمالية للوحة = أضعف حالة بين العناصر (الأكثر تحفّظًا). */
function overallState(items: LegalBasisItem[]): DocumentationState {
  if (!items.length) return "insufficient";
  const order: DocumentationState[] = ["insufficient", "unverified", "auto", "official"];
  let worstIndex = order.length - 1;
  for (const item of items) {
    const idx = order.indexOf(item.state);
    if (idx >= 0 && idx < worstIndex) worstIndex = idx;
  }
  return order[worstIndex];
}

export function LegalBasisPanel({
  items,
  title = "الأساس النظامي",
  note,
  children,
  anchorPrefix,
  defaultOpen = false
}: {
  items: LegalBasisItem[];
  title?: string;
  note?: ReactNode;
  children?: ReactNode;
  /** بادئة مرساة لبطاقات المصادر (للنقر من مراجع الإجابة). يجب أن تتفرّد عبر الأدوار. */
  anchorPrefix?: string;
  /** تُفتَح مبدئيًّا؟ الافتراض مطويّة (تأخذ مساحةً أقلّ) — يوسّعها المستخدم بالنقر. */
  defaultOpen?: boolean;
}) {
  const overall = overallState(items);
  const count = items.length;

  return (
    <details
      className="group basis-collapse rounded-[var(--r-xl)] border bg-[var(--paper)] p-5 shadow-[var(--sh-xs)]"
      style={{ borderColor: "var(--gold-border)" }}
      open={defaultOpen}
    >
      <summary
        className="basis-collapse__summary flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 border-b border-[var(--ink-08)] pb-3 focus-ring"
        aria-label={`${title} — ${count.toLocaleString("ar-SA")} سند (اضغط للطيّ أو العرض)`}
      >
        <span className="flex items-center gap-2">
          <span
            className="grid h-6 w-6 place-items-center rounded-md bg-[var(--gold-ghost)] text-[var(--gold-dark)] transition-transform group-open:rotate-90"
            aria-hidden
          >
            ›
          </span>
          <h3 className="font-display-ar text-base font-bold text-[var(--navy)]">{title}</h3>
          <span className="rounded-full bg-[var(--ink-04)] px-2 py-0.5 text-xs font-semibold text-[var(--ink-60)]">
            {count.toLocaleString("ar-SA")} سند
          </span>
        </span>
        <span className="flex items-center gap-2">
          <DocumentationBadge state={overall} />
          <span className="text-xs font-semibold text-[var(--ink-40)]">
            <span className="group-open:hidden">عرض</span>
            <span className="hidden group-open:inline">طيّ</span>
          </span>
        </span>
      </summary>

      {items.length ? (
        <ul className="mt-4 space-y-3">
          {items.map((item, index) => {
            const meta = STATE_META[item.state];
            const unit =
              Number(item.articleNumber) === 0
                ? "الديباجة"
                : item.articleNumber !== undefined && item.articleNumber !== ""
                  ? `المادة ${typeof item.articleNumber === "number" ? item.articleNumber.toLocaleString("ar-SA") : item.articleNumber}`
                  : "";
            const ref = unit ? `${item.systemName} · ${unit}` : item.systemName;
            return (
              <li
                key={`${item.systemName}-${item.articleNumber ?? index}`}
                id={anchorPrefix ? `${anchorPrefix}${index + 1}` : undefined}
                className="basis-src rounded-[var(--r-lg)] border border-[var(--ink-08)] bg-ivory/60 p-4"
                style={{ borderInlineStartColor: meta.fg, borderInlineStartWidth: 3 }}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="flex items-center gap-2 font-mono-legal text-sm text-[var(--navy)]">
                    {/* رقم الهامش — يطابق الرقم العلويّ [n] في متن الدراسة (ربطٌ بصريّ). */}
                    <span
                      className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--gold-ghost)] text-xs font-bold text-[var(--gold-dark)]"
                      aria-hidden
                    >
                      {(index + 1).toLocaleString("ar-SA")}
                    </span>
                    {ref}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <EnforcementBadge status={item.enforcement} />
                    <DocumentationBadge state={item.state} />
                  </div>
                </div>
                {item.articleTitle ? (
                  <p className="mt-1 text-sm font-semibold text-[var(--ink-80)]">{item.articleTitle}</p>
                ) : null}
                {item.quote ? (
                  <p className="mt-2 rounded-[var(--r-md)] bg-[var(--parchment)] p-3 font-judicial text-base leading-8 text-[var(--ink)]">
                    {item.quote}
                  </p>
                ) : null}
                {item.internalUrl ? (
                  <Link
                    href={item.internalUrl}
                    className="focus-ring mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[var(--gold-dark)] underline-offset-4 hover:underline"
                  >
                    فتح المادة في النواة ↗
                  </Link>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-4 rounded-[var(--r-lg)] border border-dashed border-[var(--ink-15)] bg-[var(--ink-04)] p-4 text-center text-sm leading-7 text-[var(--ink-60)]">
          لا يوجد سند نظامي كافٍ مرتبط بهذه المخرجات. يُنصح بمراجعة بشرية قبل الاعتماد.
        </p>
      )}

      {note ? <div className="mt-3 text-xs leading-6 text-[var(--ink-60)]">{note}</div> : null}
      {children}

      <p className="mt-4 border-t border-[var(--ink-08)] pt-3 text-[11px] leading-6 text-[var(--ink-40)]">
        حالات التوثيق وصفية للمصدر ولا تُعبّر عن نسبة ثقة رقمية. «موثّق رسميًا» يعني مطابقة مادة قائمة في النواة القانونية،
        و«مسترجع آليًا» يحتاج مراجعة بشرية قبل الاعتماد.
      </p>
    </details>
  );
}

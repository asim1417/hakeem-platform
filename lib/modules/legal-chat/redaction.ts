// ─────────────────────────────────────────────────────────────────────────────
// RedactionEngine — إخفاء البيانات الحساسة قبل المشاركة/التصدير.
// أنماط: الهوية الوطنية/الإقامة، السجل التجاري، IBAN، أرقام الحسابات، الجوّال.
// ثلاثة مستويات: كامل، جزئي، بلا. لا يحذف من قاعدة البيانات؛ يعالج النص المعروض/المُصدَّر.
// ─────────────────────────────────────────────────────────────────────────────

export type RedactionLevel = "FULL" | "PARTIAL" | "NONE";

interface RedactRule {
  label: string;
  re: RegExp;
}

const RULES: RedactRule[] = [
  // الهوية الوطنية/الإقامة: 10 أرقام تبدأ بـ 1 أو 2.
  { label: "هوية", re: /\b[12]\d{9}\b/g },
  // IBAN سعودي: SA ثم 22 خانة.
  { label: "آيبان", re: /\bSA\d{2}[\dA-Z]{18,20}\b/gi },
  // رقم جوال سعودي.
  { label: "جوال", re: /(?:\+?966|0)5\d{8}\b/g },
  // أرقام حسابات/سجلات طويلة (11+ رقم).
  { label: "رقم", re: /\b\d{11,}\b/g },
];

/** يقنّع قيمة جزئياً مع الإبقاء على آخر خانتين. */
function partialMask(value: string): string {
  const digits = value.replace(/\s/g, "");
  if (digits.length <= 3) return "•••";
  return `${"•".repeat(Math.max(3, digits.length - 2))}${digits.slice(-2)}`;
}

export interface RedactionResult {
  text: string;
  redactedCount: number;
  categories: string[];
}

/** يخفي البيانات الحساسة في نصّ بحسب المستوى. */
export function redactText(input: string, level: RedactionLevel): RedactionResult {
  if (level === "NONE" || !input) return { text: input, redactedCount: 0, categories: [] };
  let count = 0;
  const categories = new Set<string>();
  let text = input;
  for (const rule of RULES) {
    text = text.replace(rule.re, (match) => {
      count += 1;
      categories.add(rule.label);
      return level === "FULL" ? `⟦${rule.label}: محجوب⟧` : partialMask(match);
    });
  }
  return { text, redactedCount: count, categories: Array.from(categories) };
}

/** يطبّق الإخفاء على مصفوفة نصوص (أقسام المخرج). */
export function redactSections(
  sections: { heading: string; body: string }[],
  level: RedactionLevel
): { sections: { heading: string; body: string }[]; redactedCount: number; categories: string[] } {
  let total = 0;
  const cats = new Set<string>();
  const out = sections.map((s) => {
    const r = redactText(s.body, level);
    total += r.redactedCount;
    r.categories.forEach((c) => cats.add(c));
    return { heading: s.heading, body: r.text };
  });
  return { sections: out, redactedCount: total, categories: Array.from(cats) };
}

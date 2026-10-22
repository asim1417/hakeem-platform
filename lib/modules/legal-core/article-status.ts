/**
 * حالة المادة (نظير Citator): تحويل قيمة الحالة الخام إلى شارة عربية موحّدة عبر الواجهات.
 * تُعرض فقط عند توفّر قيمة **معروفة** — القيم غير المعروفة تُعيد null فلا تُعرض شارة، تفادياً للتضليل.
 *
 * HKM-030: تُفهم تسميات طبقة التحقق (verified-status: ساري، صادر لم يسرِ بعد، ملغى/ملغاة، مستبدل،
 * ملغى مع بقاء أحكام محددة مؤقتًا، إلغاء جزئي معلّق على شرط، مضافة) إلى جانب القيم القديمة في
 * legal_articles.status (سارية/معدّلة/منسوخة/موقوفة والإنجليزية). الملغاة تُعرض «ملغاة» لا «منسوخة».
 * المستهلكون البرمجيون يقرؤون `kind` و`inForce` لا نص الشارة.
 */
export type StatusTone = "emerald" | "amber" | "ruby";

export type ArticleStatusKind =
  | "in_force"
  | "amended"
  | "repealed"
  | "replaced"
  | "not_yet"
  | "repealed_partial"
  | "conditional_partial"
  | "suspended";

export interface ArticleStatusBadge {
  label: string;
  tone: StatusTone;
  kind: ArticleStatusKind;
  /** هل يُبنى على نصها كنصٍّ قائم؟ */
  inForce: boolean;
}

const BADGES: Record<ArticleStatusKind, Omit<ArticleStatusBadge, "kind">> = {
  in_force: { label: "سارية", tone: "emerald", inForce: true },
  amended: { label: "معدّلة", tone: "amber", inForce: true },
  repealed: { label: "ملغاة", tone: "ruby", inForce: false },
  // «مستبدل» ليس إلغاءً (قرار المالك HKM-026/028): تُعرض بنصها باهتة، ولا يُبنى عليها.
  replaced: { label: "مستبدلة", tone: "amber", inForce: false },
  not_yet: { label: "صادر لم يسرِ بعد", tone: "amber", inForce: false },
  repealed_partial: { label: "ملغى مع بقاء أحكام محددة مؤقتًا", tone: "ruby", inForce: false },
  conditional_partial: { label: "إلغاء جزئي معلّق على شرط", tone: "amber", inForce: true },
  suspended: { label: "موقوفة", tone: "amber", inForce: false },
};

/** يطبّع القيمة للمطابقة: بلا تشكيل ولا تطويل، والإنجليزية بحروف كبيرة. */
const norm = (s: string): string => s.trim().replace(/[ً-ْـ]/g, "").toUpperCase();

const KIND_BY_VALUE = new Map<string, ArticleStatusKind>();
const register = (kind: ArticleStatusKind, ...values: string[]) => {
  for (const v of values) KIND_BY_VALUE.set(norm(v), kind);
};
register("in_force", "ACTIVE", "IN_FORCE", "VALID", "سارية", "سار", "ساري", "نافذ", "نافذة");
register("amended", "AMENDED", "MODIFIED", "معدلة", "معدّلة", "معدل", "معدّل");
register("repealed", "REPEALED", "CANCELLED", "CANCELED", "منسوخة", "ملغاة", "ملغي", "ملغى", "لاغية", "لاغي");
register("replaced", "REPLACED", "SUPERSEDED", "مستبدل", "مستبدلة");
register("not_yet", "NOT_YET_IN_FORCE", "صادر لم يسرِ بعد");
register("repealed_partial", "ملغى مع بقاء أحكام محددة مؤقتًا");
register("conditional_partial", "إلغاء جزئي معلّق على شرط");
register("suspended", "SUSPENDED", "موقوفة", "معلقة");

export function articleStatusBadge(status: string | null | undefined): ArticleStatusBadge | null {
  if (!status) return null;
  const kind = KIND_BY_VALUE.get(norm(status));
  if (!kind) return null;
  const base = BADGES[kind];
  // «مضافة» سارية لكن وسمها يبقى كما في سجل التحقق.
  const label = norm(status) === norm("مضافة") ? "مضافة" : base.label;
  return { ...base, label, kind };
}
register("in_force", "مضافة");

/** ملغاة أو مستبدلة أو ملغاة مع بقاء أحكام مؤقتًا: لا تُقدَّم نصًّا قائمًا. */
export const isRepealedKind = (kind: ArticleStatusKind | null | undefined): boolean =>
  kind === "repealed" || kind === "replaced" || kind === "repealed_partial";

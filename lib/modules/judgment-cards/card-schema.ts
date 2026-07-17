/**
 * card-schema.ts — المخطّط الثابت لبطاقة الحكم + التحقّق (Zod) + التطبيع العربي.
 *
 * فلسفة: استخراج لا توليد. البطاقة مرآة الحكم. الحقل غير الموجود = null، المصفوفة الغائبة = [].
 * لا يُغيَّر المخطّط. كل ما هنا نقيّ (بلا قاعدة/شبكة) ليكون قابلاً للاختبار.
 */
import { z } from "zod";

export const EXTRACTOR_VERSION = "cards-v1";

// ── قيم مقيّدة (كما وردت في المواصفة) ──
export const CLAIM_OUTCOMES = ["قُبل", "قُبل جزئيًا", "رُفض", "لم يُفصل"] as const;
export const DEFENSE_TYPES = ["شكلي", "موضوعي"] as const;
export const DEFENSE_OUTCOMES = ["قُبل", "رُفض", "لم يُرد عليه"] as const;
export const RESULT_CATEGORIES = [
  "للمدعي كاملًا",
  "جزئيًا",
  "رفض الدعوى",
  "عدم اختصاص",
  "عدم قبول",
  "شطب/ترك",
] as const;
export const COURT_DEGREES = ["ابتدائي", "استئناف"] as const;

// حقل نصّي اختياري: يقبل "" أو غياب ويحوّلها إلى null (لا تخمين).
const nullableText = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => (v == null || String(v).trim() === "" ? null : String(v).trim()));

// حقل مقيّد متسامح: يقبل قيمة خارج القائمة لكن يبقيها نصًّا (المدقّق/الاتساق يكشفها) أو null.
const constrained = (allowed: readonly string[]) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((v) => (v == null || String(v).trim() === "" ? null : String(v).trim()));

const numericOrNull = z
  .union([z.number(), z.string(), z.null(), z.undefined()])
  .transform((v) => {
    if (v == null || v === "") return null;
    // تحويل الأرقام العربية-الهندية أولاً (\d لا يطابقها) قبل التجريد.
    const n = typeof v === "number" ? v : Number(toWesternDigits(String(v)).replace(/[^\d.]/g, ""));
    return Number.isFinite(n) ? n : null;
  });

export const ClaimSchema = z.object({
  text: nullableText,
  outcome: constrained(CLAIM_OUTCOMES),
});

export const DefenseSchema = z.object({
  text: nullableText,
  type: constrained(DEFENSE_TYPES),
  outcome: constrained(DEFENSE_OUTCOMES),
});

export const AppliedArticleSchema = z.object({
  system: nullableText, // اسم النظام كما ورد في الحكم
  article: nullableText, // رقم المادة كما ورد حرفيًّا
  quote: nullableText, // الجملة الحاملة للذكر (أساس فحص الاتساق)
});

export const JudgmentCardSchema = z.object({
  disputeType: nullableText,
  claims: z.array(ClaimSchema).catch([]).default([]),
  defenses: z.array(DefenseSchema).catch([]).default([]),
  appliedArticles: z.array(AppliedArticleSchema).catch([]).default([]),
  result: nullableText,
  resultCategory: constrained(RESULT_CATEGORIES),
  amounts: z
    .object({ claimed: numericOrNull, awarded: numericOrNull })
    .catch({ claimed: null, awarded: null })
    .default({ claimed: null, awarded: null }),
  court: z
    .object({ circuit: nullableText, degree: constrained(COURT_DEGREES), year: nullableText })
    .catch({ circuit: null, degree: null, year: null })
    .default({ circuit: null, degree: null, year: null }),
  confidence: z
    .union([z.number(), z.string(), z.null(), z.undefined()])
    .transform((v) => {
      const n = typeof v === "number" ? v : Number(v);
      if (!Number.isFinite(n)) return 0;
      return Math.min(1, Math.max(0, n));
    }),
});

export type JudgmentCard = z.infer<typeof JudgmentCardSchema>;
export type AppliedArticle = z.infer<typeof AppliedArticleSchema>;

/** يجرّد أسوار markdown ويقتطع كائن JSON الأول من ردّ النموذج. */
export function stripToJson(raw: string): string {
  let s = (raw || "").replace(/```json?/gi, "").replace(/```/g, "").trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) s = s.slice(start, end + 1);
  return s;
}

/** يحلّل ردّ النموذج إلى بطاقة مُتحقَّقة. لا يرمي — يعيد {ok,false} عند الفشل. */
export function parseCard(raw: string): { ok: true; card: JudgmentCard } | { ok: false; error: string } {
  try {
    const obj = JSON.parse(stripToJson(raw));
    const parsed = JudgmentCardSchema.safeParse(obj);
    if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
    return { ok: true, card: parsed.data };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "JSON parse error" };
  }
}

/** تطبيع عربي للمطابقة المرنة (تجريد التشكيل/التطويل، توحيد الهمزات، ة→ه، ى→ي، تبسيط المسافات). */
export function normalizeAr(s: string | null | undefined): string {
  return (s || "")
    .replace(/[ً-ْٰـ]/g, "")
    .replace(/[إأآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/\s+/g, " ")
    .trim();
}

/** تحويل الأرقام العربية-الهندية إلى غربية داخل نصّ. */
export function toWesternDigits(s: string): string {
  return (s || "").replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString());
}

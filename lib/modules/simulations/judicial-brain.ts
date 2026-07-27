// العقل القضائيّ المشترك — مصدر الحقيقة الوحيد لتأريض القاضي وإبراز قواعد الإثبات وحارس
// المخرَج. يستدعيه القاضيان: الحيّ (عبر /api/original-hakeem/ai) والحديث (عبر ai-judge.ts).
// فكرةٌ واحدة بجلدين: أيّ تحسينٍ في التأريض/الإثبات هنا ينعكس على الواجهتين معًا.
import { buildLegalContextForAI } from "@/lib/modules/legal-core/legal-retrieval";
import { collectAllowedArticleNumbers, verifyNarrativeGrounding } from "@/lib/modules/grounding/verify-guard";

// مصطلحاتٌ تُبرز نظام الإثبات في الاسترجاع (عبء الإثبات · البيّنة · الشهادة · اليمين …).
export const EVIDENCE_HINTS =
  "قواعد الإثبات وعبء الإثبات والبيّنة والشهادة واليمين والقرينة وحجيّة المستند والإقرار في نظام الإثبات";

// إشارةٌ أنّ النداء قضائيٌّ ذو وقائع (لتمييزه عن نداءات الاختبار القصيرة).
export const JUDICIAL_SIGNAL =
  /الوقائع|الطلب|الدعوى|الدفع|المدّع|المدع|الجواب|البيّن|البين|الإثبات|إثبات|الحكم|المرافعة/;

export type JudicialGrounding = {
  hasArticles: boolean;
  contextText: string;
  citationBlock: string;
  allowedNumbers: Set<number>;
  articleCount: number;
};

/**
 * يسترجع مواد النواة الحقيقيّة ذات الصلة (مع إبراز نظام الإثبات) ويجمع أرقام المواد المسموحة.
 * يُستعمَل لحقن السياق المؤرَّض في توجيه القاضي قبل التوليد.
 */
export async function groundForJudge(text: string, limit = 6, scopeSystems?: string[]): Promise<JudicialGrounding> {
  // تقييدٌ ناعمٌ بنطاق التخصّص المفعّل (أنظمة الوكيل) — يحيّز الاسترجاع نحو أنظمة نوع الدعوى.
  const scopeHint = scopeSystems?.length ? ` (ضمن الأنظمة ذات الصلة: ${scopeSystems.join("، ")})` : "";
  const ctx = await buildLegalContextForAI(`${text}${scopeHint} ${EVIDENCE_HINTS}`.slice(0, 900), { limit });
  if (!ctx.hasArticles) {
    return { hasArticles: false, contextText: "", citationBlock: "", allowedNumbers: new Set<number>(), articleCount: 0 };
  }
  return {
    hasArticles: true,
    contextText: ctx.contextText,
    citationBlock: ctx.citationBlock,
    allowedNumbers: collectAllowedArticleNumbers({ numbers: ctx.articles.map((a) => a.articleNumber) }),
    articleCount: ctx.articles.length
  };
}

/**
 * حارس التأريض بعد التوليد: يعيد true إن لم يظهر في النصوص أيّ رقم مادّة خارج المسموح.
 * مجموعةٌ فارغة ⇒ لا تأريض متاح ⇒ يُمرَّر (لا حجب كاذب).
 */
export function verifyJudgeGrounding(texts: Array<string | null | undefined>, allowed: Set<number>): boolean {
  if (allowed.size === 0) return true;
  return verifyNarrativeGrounding(texts, allowed).ok;
}

// حارس التأريض بعد التوليد (مشترك بين الخدمات الثلاث: تحليل القضية · الوكيل · المحاكاة).
// المبدأ: «النصّ من القاعدة حصريًا» — أيّ رقم مادة يظهر في سرد النموذج يجب أن يكون ضمن
// أرقام المواد المسترجَعة فعلاً من النواة. ما ليس كذلك = تلفيق يُرفَض، فيسقط السرد إلى
// الاحتياط الحتمي (المبنيّ من المدخلات + الإسناد الحقيقي بلا اختلاق).
//
// نقيّ وقابل للاختبار (بلا قاعدة بيانات): يعمل على نصوص المخرجات ومجموعة الأرقام المسموحة.
// يعيد استخدام مُحلّل أرقام المواد نفسه المستعمَل في نواة الاستشهاد (لا منطق موازٍ).
import { parseArticleNumberCandidates } from "@/lib/modules/legal-core/judgment-citation-extractor";

// إشارة المادة في نصّ حرّ: «المادة (77)» / «مادة 77» / «المادة 95/2» … نفس نمط حارس البوابة
// (guardOutputAgainstUnknownArticleNumbers) كي يتطابق مسح المخرَج مع مسح المراجع بلا انزياح.
const ARTICLE_MENTION_RE = /(?:المادة|مادة)\s*\(?\s*([0-9٠-٩]+(?:\s*\/\s*[0-9٠-٩]+)*)\s*\)?/g;
// الصيغة المختصرة «م/77» ترد أحياناً في تسميات الاستناد/المراجع (لا في سرد النموذج غالباً).
// «م» تُلزَم بأن تكون مفردة (بداية/مسافة/فاصلة/قوس قبلها) كي لا تُلتقط نهاية كلمة تنتهي بـ«م».
// (لا نستعمل \b: حدود الكلمة في JS مبنيّة على ASCII فلا تعمل قبل الحروف العربية.)
const SHORT_ARTICLE_RE = /(?:^|[\s،(])م\s*\/\s*([0-9٠-٩]+)/g;

/**
 * يجمع أرقام المواد المسموح بها من مصادر مسترجَعة متعددة (كلها من النواة الحقيقية):
 *  - `numbers`: أرقام صريحة (مثل grounding.articles[].articleNumber) — أوثق مصدر.
 *  - `references`: نصوص مراجع رسمية (مثل «نظام العمل، المادة 77» أو «م/77») تُستخرَج منها الأرقام.
 * الاتحاد يمنع الحجب الكاذب: مادة عرضها legalRag دون buildLegalContextForAI تبقى مسموحة.
 */
export function collectAllowedArticleNumbers(input: {
  numbers?: Array<number | null | undefined>;
  references?: Array<string | null | undefined>;
}): Set<number> {
  const allowed = new Set<number>();
  for (const n of input.numbers ?? []) {
    if (typeof n === "number" && Number.isFinite(n) && n > 0) allowed.add(n);
  }
  for (const ref of input.references ?? []) {
    if (!ref) continue;
    for (const m of ref.matchAll(ARTICLE_MENTION_RE)) {
      for (const c of parseArticleNumberCandidates(m[1])) if (c > 0) allowed.add(c);
    }
    for (const m of ref.matchAll(SHORT_ARTICLE_RE)) {
      for (const c of parseArticleNumberCandidates(m[1])) if (c > 0) allowed.add(c);
    }
  }
  return allowed;
}

/** يجمع كل السلاسل النصّية داخل قيمة (كائن سرد النموذج) بشكل تكراري — لفحصها كلها. */
export function collectStrings(value: unknown, acc: string[] = []): string[] {
  if (typeof value === "string") {
    if (value.trim()) acc.push(value);
  } else if (Array.isArray(value)) {
    for (const v of value) collectStrings(v, acc);
  } else if (value && typeof value === "object") {
    for (const v of Object.values(value)) collectStrings(v, acc);
  }
  return acc;
}

export interface GroundingVerdict {
  /** true إذا لم يظهر أيّ رقم مادة غير مؤرَّض في السرد. */
  ok: boolean;
  /** أرقام المواد التي ظهرت في السرد ولا سند لها في الاسترجاع (للتسجيل/التشخيص). */
  offending: number[];
}

/**
 * يفحص نصوص سرد النموذج: كل إشارة «المادة N» يجب أن تكون N ضمن المسموح، وإلا فهي غير مؤرَّضة.
 * إشارة «س/ص» قد يكون أيّ طرفيها رقم المادة؛ لا تُعدّ مخالفة إلا إن لم يكن أيّ مرشّح مسموحاً.
 */
export function verifyNarrativeGrounding(texts: Array<string | null | undefined>, allowed: Set<number>): GroundingVerdict {
  const offending: number[] = [];
  for (const text of texts) {
    if (!text) continue;
    for (const m of text.matchAll(ARTICLE_MENTION_RE)) {
      const candidates = parseArticleNumberCandidates(m[1]).filter((n) => n > 0);
      if (candidates.length && !candidates.some((n) => allowed.has(n))) offending.push(candidates[0]);
    }
  }
  return { ok: offending.length === 0, offending: Array.from(new Set(offending)) };
}

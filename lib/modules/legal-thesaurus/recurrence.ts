/**
 * recurrence.ts — برهان التكرار والموقع (نقيّ، بلا قاعدة).
 *
 * القاعدة: لا يُعتمد التكرار بالعدد وحده. كل قوّة تكرار تُشتق من **مواضع فعلية**
 * (مواد + أنظمة + ورود) يُحتفظ بها في legal_thesaurus_occurrences. هذه الدوال
 * تصنّف القوة والموقع من تلك المواضع — لا تخترع عدداً بلا مواضع.
 */

export type RecurrenceStrength =
  | "single_occurrence" // ورود واحد فقط
  | "repeated_in_same_article" // تكرّر داخل المادة نفسها فقط
  | "repeated_in_same_system" // تكرّر في عدّة مواد من النظام نفسه
  | "repeated_across_systems" // تكرّر عبر أكثر من نظام
  | "high_frequency_core_concept"; // مفهوم محوري عالي التردد

export interface RecurrenceStats {
  totalOccurrences: number;
  distinctArticles: number;
  distinctSources: number;
}

/** عتبات المفهوم المحوري عالي التردد. */
export const CORE_CONCEPT_MIN_ARTICLES = 8;
export const CORE_CONCEPT_MIN_OCCURRENCES = 15;

/** يصنّف قوة التكرار من مواضع فعلية (لا من العدد وحده). */
export function classifyRecurrence(s: RecurrenceStats): RecurrenceStrength {
  if (s.totalOccurrences <= 0) return "single_occurrence";
  if (s.distinctArticles >= CORE_CONCEPT_MIN_ARTICLES && s.totalOccurrences >= CORE_CONCEPT_MIN_OCCURRENCES) {
    return "high_frequency_core_concept";
  }
  if (s.distinctSources >= 2) return "repeated_across_systems";
  if (s.distinctArticles >= 2) return "repeated_in_same_system";
  if (s.totalOccurrences >= 2) return "repeated_in_same_article";
  return "single_occurrence";
}

export type PositionClass = "early_articles" | "middle_articles" | "late_articles";

/** يحوّل نسبة موقع المادة (0..1) إلى فئة موقع. */
export function positionRatioToClass(ratio: number): PositionClass {
  if (ratio < 1 / 3) return "early_articles";
  if (ratio < 2 / 3) return "middle_articles";
  return "late_articles";
}

export type SourcePosition = PositionClass | "all_system";

/** يصنّف موقع المفهوم من مجموعة نسب مواضعه (early/middle/late أو all_system). */
export function classifySourcePosition(ratios: number[]): SourcePosition {
  if (!ratios.length) return "all_system";
  const classes = new Set(ratios.map(positionRatioToClass));
  if (classes.size >= 3) return "all_system";
  // إن غطّى أوّلاً وآخراً ولو بلا وسط، نعدّه ممتداً على النظام
  if (classes.has("early_articles") && classes.has("late_articles")) return "all_system";
  // فئة واحدة سائدة
  if (classes.size === 1) return [...classes][0];
  // فئتان متجاورتان: نُرجِع الأبكر (الأكثر تحفّظاً في وصف الموقع)
  if (classes.has("early_articles")) return "early_articles";
  return "middle_articles";
}

/** نطاق الاستخراج للمفهوم وفق مصادر سنده (تعريف صريح / متن / مختلط). */
export function classifyScope(hasDefinition: boolean, hasBody: boolean): "definitions_only" | "full_body" | "mixed" {
  if (hasDefinition && hasBody) return "mixed";
  if (hasDefinition) return "definitions_only";
  return "full_body";
}

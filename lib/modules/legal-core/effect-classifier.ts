/**
 * يصنّف صيغة أثر المرسوم. لا يكتب شيئًا.
 * «ويلغي كل ما يتعارض معه» ليست إلغاءً لنظام بعينه.
 */

export const EFFECT_FORMULAS = [
  "تعديل المادة لتكون بالنص الآتي",
  "إضافة مادة أو فقرة",
  "حذف",
  "إلغاء",
  "إحلال",
  "استبدال عبارة بعبارة",
  "غير مصنّف",
] as const;

export type EffectFormula = (typeof EFFECT_FORMULAS)[number];

export interface ClassifiedEffect {
  formula: EffectFormula;
  explicitTarget: boolean;
  blanketConflictClause: boolean;
}

export function classifyEffectText(text: string): ClassifiedEffect {
  const t = String(text ?? "");
  const blanket = /يلغي كل ما يتعارض معه/.test(t);
  const explicitRepeal = /(?:يُلغى|يلغى|إلغاء)\s+(?:نظام|المادة|مادة)\s+/u.test(t);
  let formula: EffectFormula = "غير مصنّف";
  if (/تعديل المادة[\s\S]{0,40}لتكون بالنص الآتي/.test(t)) formula = "تعديل المادة لتكون بالنص الآتي";
  else if (/إضافة (?:مادة|فقرة)/.test(t)) formula = "إضافة مادة أو فقرة";
  else if (/استبدال العبارة|تُستبدل عبارة|يستبدل ب/.test(t)) formula = "استبدال عبارة بعبارة";
  else if (/إحلال|يحل محل/.test(t)) formula = "إحلال";
  else if (/(?:حذف|تُحذف|تحذف)\s+(?:المادة|مادة|الفقرة|فقرة)/.test(t)) formula = "حذف";
  else if (explicitRepeal) formula = "إلغاء";
  return { formula, explicitTarget: explicitRepeal || formula !== "غير مصنّف", blanketConflictClause: blanket };
}

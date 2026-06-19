/**
 * scoring.ts — تقييم ثقة المرشّحات (نقيّ). نظام الثقة:
 *  95–100: مفهوم مؤكد بتعريف صريح أو سند قوي.
 *  85–94 : قوي، يُعتمد مبدئياً مع قابلية المراجعة.
 *  70–84 : محتمل، يُحال للمراجعة.
 *  <70   : ضعيف، لا يُعتمد.
 */

export interface DefinedTermScoreInput {
  definitionLength: number;
  sourceStatus?: string | null; // حالة المادة (سارية / needs_review …)
  termWordCount: number;
}

/** درجة مصطلح مُعرَّف صراحةً (أعلى ثقة). */
export function scoreDefinedTerm(i: DefinedTermScoreInput): number {
  let s = 96;
  if (i.definitionLength < 15) s -= 6; // تعريف قصير جداً
  if (i.termWordCount > 6) s -= 6; // عبارة طويلة (قد تكون جملة لا مصطلح)
  if (i.sourceStatus && i.sourceStatus !== "سارية") s -= 4; // مادة غير مؤكدة السريان
  return clamp(s);
}

export interface ReviewDecision {
  needsReview: boolean;
  reasons: string[];
}

/** قرار المراجعة البشرية وفق الثقة والإشارات. */
export function decideReview(score: number, flags: { multiMeaning?: boolean; nearExisting?: boolean; inferredDefinition?: boolean } = {}): ReviewDecision {
  const reasons: string[] = [];
  if (score < 85) reasons.push("confidence_below_85");
  if (flags.multiMeaning) reasons.push("multi_meaning_across_systems");
  if (flags.nearExisting) reasons.push("near_existing_concept");
  if (flags.inferredDefinition) reasons.push("definition_inferred_not_explicit");
  return { needsReview: reasons.length > 0, reasons };
}

/** حالة المفهوم وفق الثقة: معتمد آلياً (≥85 بلا إشارات) أو مرشّح للمراجعة. */
export function conceptStatus(score: number, review: ReviewDecision): "approved" | "candidate" {
  return score >= 85 && !review.needsReview ? "approved" : "candidate";
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

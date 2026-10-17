// منطق مراجعة المبدأ القضائي المستخرج آليًّا — مشترك بين زر الاعتماد القائم وطابور مكتب التحرير،
// حتى يعطي المساران النتيجة نفسها في reviewStatus.

export type PrincipleReviewDecision = "approve" | "reject" | "reset";

/** خريطة القرار → حالة المراجعة المخزّنة في judicial_principles.reviewStatus. */
export const PRINCIPLE_REVIEW_STATUS: Record<PrincipleReviewDecision, string> = {
  approve: "reviewed",
  reject: "rejected",
  reset: "needs_review",
};

export function principleStatusFor(decision: PrincipleReviewDecision): string {
  return PRINCIPLE_REVIEW_STATUS[decision];
}

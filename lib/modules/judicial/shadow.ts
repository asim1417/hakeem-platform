// ─────────────────────────────────────────────────────────────────────────────
// §27/§31-I — مساعد الظلّ المشترك (Shared Shadow Review) — لكلّ الخدمات المنتِجة.
//
// أيّ خدمة (القاضي، الوكيل، المحاكاة، تحليل القضية، مشروع الحكم…) تستدعيه بعد التوليد
// فتُرفق مراجعة بوّابات JDS **الاسترشاديّة** بمخرجها — دون تغيير النصّ. يُرجِع undefined
// ما لم يُفعَّل JDS_DRAFTING_SHADOW (افتراض OFF ⇒ صفر تغيير). لا يرمي أبدًا (سقوطٌ آمن).
// ─────────────────────────────────────────────────────────────────────────────
import type { CourtTrack, DocumentFunction, JudicialRole, LitigationStage } from "./contracts";
import type { DraftStatement } from "./gate-executor";
import { isJdsDraftingShadowEnabled } from "./flag";
import { planJudicialTask, reviewJudicialDraft } from "./orchestrator";

/** شكل المراجعة الاسترشاديّة المرفقة بمخرجات الخدمات. */
export interface JdsShadowReview {
  ready: boolean;
  blocking: string[];
  review: string[];
  findings: Array<{ gateId: string; outcome: string; findings: string[] }>;
}

export interface ShadowReviewInput {
  role: JudicialRole;
  documentFunction: DocumentFunction;
  litigationStage?: LitigationStage;
  courtTrack?: CourtTrack;
  subject?: string;
  draftText: string;
  requests?: string[];
  dispositionItems?: string[];
  objectionRoute?: "APPEAL" | "CASSATION" | "RECONSIDERATION";
  hasNonBindingLabel?: boolean;
  statements?: DraftStatement[];
}

/** مراجعةٌ ظلّيّة موحّدة — undefined ما لم يُفعَّل العَلَم؛ لا ترمي. */
export function judicialShadowReview(input: ShadowReviewInput): JdsShadowReview | undefined {
  if (!isJdsDraftingShadowEnabled()) return undefined;
  try {
    const plan = planJudicialTask({
      taskId: "shadow",
      role: input.role,
      documentFunction: input.documentFunction,
      litigationStage: input.litigationStage,
      courtTrack: input.courtTrack,
      text: input.subject,
    });
    const r = reviewJudicialDraft(plan, {
      draftText: input.draftText,
      requests: input.requests,
      dispositionItems: input.dispositionItems,
      objectionRoute: input.objectionRoute,
      hasNonBindingLabel: input.hasNonBindingLabel,
      statements: input.statements,
    });
    return {
      ready: r.ready,
      blocking: r.blocking,
      review: r.review,
      findings: r.results.map((g) => ({ gateId: g.gateId, outcome: g.outcome, findings: g.findings })),
    };
  } catch {
    return undefined;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// JS-001 الملخّص التنفيذيّ — يبني على عملنا السابق (وكيل الأنظمة المؤصَّل).
// المرجع: §16 (JS-001)، §18.3 (UC-03: كلّ فقرة مدعومة، لا مادّة من الذاكرة)، §6 (المصدر قبل الإجابة).
// يعيد استخدام createAgentConsultationDraft: استرجاعٌ مقيّد + تحقّق + حجبٌ صادق عند غياب السند.
// لا يولّد نصًّا نظاميًّا من ذاكرة النموذج؛ الاستشهاد مرتبطٌ بمعرّفات مواد حقيقيّة في النواة.
// ─────────────────────────────────────────────────────────────────────────────
import { createAgentConsultationDraft } from "@/lib/modules/consultations/agent-consultation";
import type { ExecutiveSummaryResult, JudicialCase } from "./types";
import { STAGE_META } from "./catalog";
import { buildRelevantDocs } from "./case-search";

const HUMAN_REVIEW_NOTICE =
  "هذا الملخّص عملٌ معاون يخضع لمراجعة القاضي؛ لا يعتمد حكمًا ولا يغني عن قراءة المصادر. كلّ إسنادٍ قابلٌ للفتح والتحقّق.";
const BLOCKED_NOTICE =
  "لم يُعثر على مادّةٍ نظاميّة مطابقة في النواة القانونيّة لتأصيل ملخّصٍ نظاميّ. عُرضت وقائع القضية دون جزمٍ نظاميّ (تعطّلٌ آمن).";

/**
 * يحوّل القضية إلى نصّ وقائع يُرسل للاسترجاع. المادّة الأساسيّة **مرفقات المستخدم** (النصّ
 * المُستخرَج)، تُضاف إليها الخريطة إن وُجدت. حدٌّ للطول كي لا نُغرِق النموذج.
 */
function buildFactsText(kase: JudicialCase): string {
  const parties = kase.parties.map((p) => `- ${p.role}: ${p.name}`).join("\n");
  const requests = kase.requests.map((r) => `- ${r.text}`).join("\n");
  const facts = kase.facts
    .filter((f) => f.status === "established" || f.status === "admitted")
    .map((f) => `- ${f.text}`)
    .join("\n");
  const issues = kase.issues.map((i) => `- ${i.statement}`).join("\n");
  // مقاطعُ ذات صلة من مستندات القضية (بحثٌ فوريّ بمحرّك منصّة الوثائق)، بسقفٍ إجماليّ.
  const docs = buildRelevantDocs(kase, [kase.subject, ...kase.issues.map((i) => i.statement), ...kase.requests.map((r) => r.text)].join(" "), 12_000);
  return [
    `نوع القضاء: ${kase.jurisdiction}`,
    `موضوع القضية: ${kase.subject}`,
    `المرحلة: ${STAGE_META[kase.stage].label}`,
    parties ? `الأطراف:\n${parties}` : "",
    requests ? `الطلبات:\n${requests}` : "",
    facts ? `الوقائع الثابتة/المُقرّة:\n${facts}` : "",
    issues ? `المسائل محلّ الفصل:\n${issues}` : "",
    docs ? `مقتطفات من مرفقات القضية:\n${docs}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * ينشئ ملخّصًا تنفيذيًّا مؤصَّلًا للقضية. يمرّ عبر خطّ الاسترجاع/التحقّق نفسه المستخدم في
 * «الاستشارة»، فيرث الحجب الصادق وحارس أرقام المواد غير المؤصَّلة. يوسم دائمًا بوجوب المراجعة.
 */
export async function generateExecutiveSummary(
  kase: JudicialCase,
  actorId?: string
): Promise<ExecutiveSummaryResult> {
  const facts = buildFactsText(kase);
  const draft = await createAgentConsultationDraft({ facts, actorId });

  return {
    requestId: draft.requestId,
    blocked: draft.blocked,
    summary: draft.blocked ? BLOCKED_NOTICE : draft.output,
    citations: draft.citations,
    humanReviewRequired: true,
    generatedAtLabel: "أُنشئ الآن — مسودّةٌ تحتاج تثبيتًا بشريًّا",
    notice: draft.blocked ? BLOCKED_NOTICE : HUMAN_REVIEW_NOTICE,
  };
}

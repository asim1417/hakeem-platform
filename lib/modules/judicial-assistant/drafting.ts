// ─────────────────────────────────────────────────────────────────────────────
// JS-018 مشروع الحكم — مركز الصياغة، مؤصَّلٌ على النواة (§22، §51–§54).
// لا قوالب مُختلقة: الهيكل حتميّ من بيانات القضية، والتسبيب مؤصَّلٌ بمواد النواة عبر الوكيل
// (يرث حارس التلفيق والحجب الصادق)، والسوابق من أحكام النواة الحقيقيّة. كلّه مسودّة human-in-loop.
// ─────────────────────────────────────────────────────────────────────────────
import { createAgentConsultationDraft } from "@/lib/modules/consultations/agent-consultation";
import { findPrecedents } from "./rulings";
import { STAGE_META } from "./catalog";
import { JURISDICTION_LABEL, FACT_STATUS_LABEL } from "./labels";
import { buildRelevantDocs } from "./case-search";
import type { JudgmentDraftResult, JudgmentSection, JudicialCase } from "./types";

const NOTICE =
  "مشروع حكمٍ مسودّة: الهيكل من بيانات القضية، والتسبيب مؤصَّلٌ بمواد النواة، والسوابق من أحكام النواة. يحتاج تدقيق القاضي واعتماده — لا يُنشئ نصًّا نظاميًّا من الذاكرة، ولا يقرّر النتيجة.";
const BLOCKED_NOTICE =
  "لم تكفِ مواد النواة لتأصيل تسبيبٍ نظاميّ. عُرض الهيكل والوقائع والسوابق دون تسبيبٍ مؤصَّل (تعطّلٌ آمن).";

/** ديباجة حتميّة من رأس القضية. */
function preamble(kase: JudicialCase): string {
  const parties = kase.parties.map((p) => `${p.role}: ${p.name}`).join("، ");
  return [
    `${kase.court}${kase.circuit ? ` — ${kase.circuit}` : ""}`,
    `القضية رقم ${kase.caseNumber} (قضاء ${JURISDICTION_LABEL[kase.jurisdiction]})`,
    `الموضوع: ${kase.subject}`,
    `الأطراف: ${parties}`,
    `المرحلة: ${STAGE_META[kase.stage].label}`,
  ].join("\n");
}

/** الوقائع المحرّرة: الثابت/المُقرّ أولًا، ويُميَّز غير المحسوم. */
function factsSection(kase: JudicialCase): string {
  return kase.facts
    .map((f) => `- (${FACT_STATUS_LABEL[f.status]}) ${f.text} [المصدر: ${f.sourceLabel}]`)
    .join("\n");
}

function operativeScaffold(kase: JudicialCase): string {
  return [
    "يُقترح على القاضي الفصل في الطلبات الآتية (منطوقٌ مقترحٌ لا حكم):",
    ...kase.requests.map((r, i) => `${i + 1}. ${r.text}`),
    "— يتحقّق القاضي من: تحديد الملزَم والمستفيد، المحل، المقدار، والاتساق مع الأسباب (فحص المنطوق §54).",
  ].join("\n");
}

/** يبني مشروع الحكم: هيكل حتميّ + تسبيبٌ مؤصَّل + سوابق النواة. */
export async function buildJudgmentDraft(kase: JudicialCase, actorId?: string): Promise<JudgmentDraftResult> {
  // تسبيبٌ مؤصَّل: يمرّ بخطّ الاسترجاع/التحقّق نفسه (استشهادات بمعرّفات حقيقيّة أو حجب صادق).
  const issues = kase.issues.map((i) => i.statement).join("؛ ");
  const established = kase.facts
    .filter((f) => f.status === "established" || f.status === "admitted")
    .map((f) => f.text)
    .join("؛ ");
  // بحثٌ فوريّ في مستندات القضية عن المقاطع المتعلّقة بالمسائل والوقائع (بمحرّك منصّة الوثائق).
  const docs = buildRelevantDocs(kase, [kase.subject, issues, established].filter(Boolean).join(" "), 8_000);
  const reasoningPrompt = [
    `نوع القضاء: ${kase.jurisdiction}. الموضوع: ${kase.subject}.`,
    `المسائل محلّ الفصل: ${issues || "—"}.`,
    `الوقائع الثابتة/المُقرّة: ${established || "—"}.`,
    docs ? `مقاطعُ ذات صلة من مستندات القضية:\n${docs}` : "",
    "المطلوب: بناء تسبيبٍ قضائيّ (واقعة-قاعدة-تطبيق) لكلّ مسألة، مؤصَّلًا بمواد النظام الحاكم فقط.",
  ].filter(Boolean).join("\n");

  const [reasoning, precedents] = await Promise.all([
    createAgentConsultationDraft({ facts: reasoningPrompt, actorId }).catch(() => null),
    findPrecedents(kase),
  ]);

  const blocked = !reasoning || reasoning.blocked;

  const sections: JudgmentSection[] = [
    { key: "preamble", title: "الديباجة والبيانات", body: preamble(kase), generated: false },
    { key: "facts", title: "الوقائع", body: factsSection(kase), generated: false },
    { key: "issues", title: "المسائل محلّ الفصل", body: kase.issues.map((i, n) => `${n + 1}. ${i.statement}`).join("\n") || "—", generated: false },
    {
      key: "reasoning",
      title: "الأسباب (التسبيب)",
      body: blocked ? BLOCKED_NOTICE : reasoning!.output,
      generated: true,
    },
    { key: "operative", title: "المنطوق المقترح", body: operativeScaffold(kase), generated: false },
  ];

  return {
    serviceId: "JS-018",
    blocked,
    sections,
    citations: reasoning?.citations ?? [],
    precedents,
    requestId: reasoning?.requestId ?? "no-reasoning",
    notice: blocked ? BLOCKED_NOTICE : NOTICE,
  };
}

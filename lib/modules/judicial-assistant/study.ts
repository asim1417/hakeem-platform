// ─────────────────────────────────────────────────────────────────────────────
// JS-013 الدراسة القضائيّة المعمّقة (§16، §18.6 UC-06، §49 البدائل/التفسيرات المتنافسة).
// دراسةٌ مؤصَّلة لمسائل القضية: تحليل واقعة-قاعدة-تطبيق لكلّ مسألة، مع إظهار البدائل، مستندةً
// إلى مواد النواة (عبر الوكيل المؤصَّل) وسوابقها. تُبنى من الخريطة المُثبَّتة + المرفقات. مسودّة.
// لا نصّ نظاميّ من الذاكرة (يرث حارس التلفيق والحجب الصادق).
// ─────────────────────────────────────────────────────────────────────────────
import { createAgentConsultationDraft } from "@/lib/modules/consultations/agent-consultation";
import { findPrecedents } from "./rulings";
import { JURISDICTION_LABEL } from "./labels";
import { buildRelevantDocsAsync } from "./case-vector";
import type { JudicialCase, JudicialStudyResult, StudyDepth } from "./types";

const DEPTH_LABEL: Record<StudyDepth, string> = { short: "مختصرة", medium: "متوسّطة", extended: "موسّعة" };
const DEPTH_DIRECTIVE: Record<StudyDepth, string> = {
  short: "دراسةٌ مختصرة: أبرز المسائل والقاعدة الحاكمة لكلٍّ بإيجاز.",
  medium: "دراسةٌ متوسّطة: لكلّ مسألة تحليل واقعة-قاعدة-تطبيق مع أهمّ البدائل.",
  extended: "دراسةٌ موسّعة: لكلّ مسألة تحليلٌ مفصّل، القواعد المنطبقة، التفسيرات المتنافسة والبدائل، وأثر كلٍّ.",
};

const NOTICE =
  "دراسةٌ مساعدة مسودّة، مؤصَّلةٌ بمواد النواة وسوابقها. تُظهر البدائل ولا تقرّر نتيجة القضية؛ تحتاج تدقيق القاضي. لا تُنشئ نصًّا نظاميًّا من الذاكرة.";
const BLOCKED_NOTICE =
  "لم تكفِ مواد النواة لتأصيل دراسةٍ نظاميّة على مسائل القضية. عُرضت السوابق دون تحليلٍ مؤصَّل (تعطّلٌ آمن).";

export async function buildJudicialStudy(
  kase: JudicialCase, depth: StudyDepth = "medium", actorId?: string
): Promise<JudicialStudyResult> {
  const issueList = kase.issues.map((i) => i.statement);
  const established = kase.facts
    .filter((f) => f.status === "established" || f.status === "admitted")
    .map((f) => f.text);

  const docs = await buildRelevantDocsAsync(kase, [kase.subject, ...issueList, ...established].join(" "), 8_000);

  const prompt = [
    `نوع القضاء: ${JURISDICTION_LABEL[kase.jurisdiction]}. موضوع القضية: ${kase.subject}.`,
    issueList.length ? `المسائل محلّ الفصل:\n${issueList.map((s, i) => `${i + 1}. ${s}`).join("\n")}` : "المسائل: استخرِجها من الوقائع أدناه.",
    established.length ? `الوقائع الثابتة/المُقرّة:\n${established.map((t) => `- ${t}`).join("\n")}` : "",
    docs ? `مقاطعُ ذات صلة من مستندات القضية:\n${docs}` : "",
    DEPTH_DIRECTIVE[depth],
    "استند حصريًّا لمواد النظام الحاكم المرفقة من النواة. أظهِر البدائل/التفسيرات المتنافسة حيث وُجدت. إن لم تكفِ المواد فصرّح بذلك.",
  ].filter(Boolean).join("\n");

  const [study, precedents] = await Promise.all([
    createAgentConsultationDraft({ facts: prompt, actorId, fallbackToFacts: true }).catch(() => null),
    findPrecedents(kase),
  ]);

  const blocked = !study || study.blocked;
  return {
    serviceId: "JS-013",
    blocked,
    depth,
    body: blocked ? BLOCKED_NOTICE : study!.output,
    citations: study?.citations ?? [],
    precedents,
    issues: issueList,
    requestId: study?.requestId ?? "no-study",
    notice: blocked ? BLOCKED_NOTICE : `${NOTICE} (عمق: ${DEPTH_LABEL[depth]})`,
  };
}

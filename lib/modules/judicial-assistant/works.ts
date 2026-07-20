// ─────────────────────────────────────────────────────────────────────────────
// محرّك الأعمال المؤصَّلة الموحَّد — يخدم خدمات النموذج (JS-002/003/011/012/014/015/016/017/021/022).
// كلٌّ منها = تأطيرٌ مختلف فوق خطّ الاسترجاع/التحقّق نفسه (createAgentConsultationDraft):
// استشهادٌ بمواد النواة الحقيقيّة أو حجبٌ صادق، بلا نصٍّ نظاميّ من الذاكرة، وكلّه مسودّة human-in-loop.
// ─────────────────────────────────────────────────────────────────────────────
import { createAgentConsultationDraft } from "@/lib/modules/consultations/agent-consultation";
import { findPrecedents } from "./rulings";
import { JURISDICTION_LABEL } from "./labels";
import type { GroundedWorkResult, JudicialCase } from "./types";

interface WorkSpec {
  title: string;
  directive: string; // تعليمة العمل المحدّدة
  withPrecedents: boolean; // إرفاق سوابق النواة؟
}

export const WORK_SPECS: Record<string, WorkSpec> = {
  "JS-002": { title: "مذكّرة الإحاطة", directive: "اكتب مذكّرة إحاطةٍ منظّمة (نحو صفحة) للقاضي عن حالة القضية: الأطراف، الطلبات، أبرز الوقائع، المسائل، والموقف الإجرائيّ.", withPrecedents: false },
  "JS-003": { title: "الملخّص التفصيليّ", directive: "لخّص مرفقات القضية تفصيليًّا بحسب كلّ مستندٍ وموضوع، مع إبراز ما يخدم الفصل.", withPrecedents: false },
  "JS-011": { title: "تحضير الجلسة", directive: "جهّز الجلسة القادمة: محاور المناقشة، أسئلةٌ للأطراف (لا أوامر)، والنواقص المطلوب استكمالها. ميّز السؤال المقترح عن الإجراء النظاميّ.", withPrecedents: false },
  "JS-012": { title: "مقارنة الأقوال", directive: "قارن الأقوال والمذكّرات في المرفقات وأبرِز التعارضات والتغيّرات في المواقف، مع الإشارة إلى موضع كلٍّ.", withPrecedents: false },
  "JS-014": { title: "مذكّرة مسألة", directive: "اكتب مذكّرةً قانونيّة مركّزة في المسائل محلّ الفصل: تكييفها، القاعدة الحاكمة، والتطبيق.", withPrecedents: true },
  "JS-015": { title: "قرار إجرائيّ", directive: "صُغ مسودّة قرارٍ إجرائيّ مناسبٍ للموقف الراهن (سببٌ ثمّ إجراء)، دون تجاوز الطلبات.", withPrecedents: false },
  "JS-016": { title: "صياغة الوقائع", directive: "حرّر الوقائع من المصادر المثبتة بأسلوبٍ قضائيّ: نسبة القول لقائله، وعدم خلط الواقعة بالنتيجة.", withPrecedents: false },
  "JS-017": { title: "بناء التسبيب", directive: "ابنِ سلسلة تسبيبٍ لكلّ مسألة: واقعة ثابتة ← قاعدة نظاميّة ← تطبيق ← نتيجة، مع ربط كلّ نتيجةٍ بمقدّماتها.", withPrecedents: true },
  "JS-021": { title: "تحليل الاعتراض", directive: "حلّل الحكم/الاعتراض في المرفقات: أسباب الاعتراض ومواضعها في الحكم وأثر كلّ سببٍ محتمل. أظهِر ما يحتاج تحقّقًا (كالمدد) دون جزم.", withPrecedents: true },
  "JS-022": { title: "مذكّرة الردّ على الاعتراض", directive: "صُغ مسودّة ردٍّ على أسباب الاعتراض الواردة في المرفقات، مؤصَّلةً بالمواد، مع بيان ما يدعم سلامة الحكم.", withPrecedents: true },
};

function buildBasePrompt(kase: JudicialCase, directive: string): string {
  const issues = kase.issues.map((i) => i.statement);
  const established = kase.facts.filter((f) => f.status === "established" || f.status === "admitted").map((f) => f.text);
  let budget = 10_000;
  const docs = kase.attachments
    .map((a) => {
      const slice = a.text.slice(0, Math.max(0, budget));
      budget -= slice.length;
      return slice ? `— «${a.name}»:\n${slice}` : "";
    })
    .filter(Boolean)
    .join("\n\n");
  return [
    `نوع القضاء: ${JURISDICTION_LABEL[kase.jurisdiction]}. موضوع القضية: ${kase.subject}.`,
    issues.length ? `المسائل محلّ الفصل:\n${issues.map((s, i) => `${i + 1}. ${s}`).join("\n")}` : "",
    established.length ? `الوقائع الثابتة/المُقرّة:\n${established.map((t) => `- ${t}`).join("\n")}` : "",
    docs ? `مقتطفات من مرفقات القضية:\n${docs}` : "",
    `المطلوب: ${directive}`,
    "استند حصريًّا لمواد النظام الحاكم المرفقة من النواة. إن لم تكفِ المواد فصرّح بذلك بدل الاختلاق.",
  ].filter(Boolean).join("\n");
}

const HUMAN_NOTICE = "مخرَجٌ مساعد مسودّة يخضع لمراجعة القاضي واعتماده. مؤصَّلٌ بمواد النواة؛ لا يعتمد حكمًا ولا يُنشئ نصًّا نظاميًّا من الذاكرة.";
const BLOCKED = "لم تكفِ مواد النواة لتأصيل هذا العمل. لم يُبنَ محتوًى نظاميّ من الذاكرة (تعطّلٌ آمن).";

/** يشغّل عملًا مؤصَّلًا موحَّدًا بحسب معرّف الخدمة. */
export async function runGroundedWork(serviceId: string, kase: JudicialCase, actorId?: string): Promise<GroundedWorkResult> {
  const spec = WORK_SPECS[serviceId];
  if (!spec) throw new Error(`خدمة غير معروفة: ${serviceId}`);

  const prompt = buildBasePrompt(kase, spec.directive);
  const [draft, precedents] = await Promise.all([
    createAgentConsultationDraft({ facts: prompt, actorId }).catch(() => null),
    spec.withPrecedents ? findPrecedents(kase) : Promise.resolve([]),
  ]);

  const blocked = !draft || draft.blocked;
  return {
    serviceId,
    title: spec.title,
    blocked,
    body: blocked ? BLOCKED : draft!.output,
    citations: draft?.citations ?? [],
    precedents,
    requestId: draft?.requestId ?? "no-work",
    notice: blocked ? BLOCKED : HUMAN_NOTICE,
  };
}

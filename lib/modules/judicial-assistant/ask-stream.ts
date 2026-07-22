// ─────────────────────────────────────────────────────────────────────────────
// موجّه المعاون — بثٌّ حيّ حقيقيّ: خطوات البحث ثمّ **التوليد كلمةً كلمةً من النموذج**
// (streamWithConfig) بدل انتظار محرّكٍ عميقٍ يكتمل ثمّ يُعاد نصّه — فيظهر الناتج حيًّا
// ويكتمل ضمن مهلة الدالّة (لا انقطاعٍ بعد البحث). مؤصَّلٌ بالنواة أو بمستندات القضية، بلا اختلاق.
// ─────────────────────────────────────────────────────────────────────────────
import { randomUUID } from "crypto";
import type { JudicialCase } from "./types";
import { isSmalltalk, caseContext, GREETING, GREETING_INVITE_CASE, GREETING_INVITE_GENERAL } from "./ask";
import { retrieveCasePassages } from "./case-vector";
import { runCaseAgent } from "@/lib/modules/agents/case-agent-bridge";
import { resolveAiConfig, streamWithConfig } from "@/lib/modules/ai/ai-config";

export type AskCitation = { articleId: string; lawName: string; articleNumber: number; quote: string };

export type AskStreamEvent =
  | { type: "stage"; label: string; state: "active" | "done" }
  | { type: "delta"; text: string }
  | { type: "done"; blocked: boolean; citations: AskCitation[]; notice: string; answer: string; requestId: string; greeting?: boolean };

const JUDICIAL_PROMPT = [
  "أنت «موجّه المعاون القضائيّ» داخل منصّة حكيم — تعين القاضي السعوديّ في تحليل مسألته.",
  "اكتب بصيغة Markdown بأسلوبٍ قضائيّ منظّمٍ عمليّ: المسألة ← القاعدة ← التطبيق ← الخلاصة (عناوين ##، قوائم، غامق للمهمّ).",
  "المخرَج مسودّةٌ تحتاج مراجعة القاضي واعتماده؛ لا تعتمد حكمًا ولا رأيًا نهائيًّا. اختم بتنبيهٍ مهنيّ مختصر.",
].join("\n");

const NOTICE_OK = "إجابةٌ مؤصَّلةٌ بمواد النواة — مسودّة لمراجعتك.";
const NOTICE_CASE = "إجابةٌ مبنيّةٌ على مستندات قضيتك ووقائعها (لا سند نظاميّ مطابق في النواة بعد) — مسودّة لمراجعتك.";

function supportingBlock(agent: { rulings?: Array<{ title?: string; snippet?: string }>; principles?: Array<{ title?: string; snippet?: string }> } | null): string {
  if (!agent) return "";
  const rul = (agent.rulings ?? []).slice(0, 5).map((r) => `- حكم: ${r.title ?? ""}${r.snippet ? " — " + r.snippet.slice(0, 200) : ""}`.trim());
  const prin = (agent.principles ?? []).slice(0, 5).map((p) => `- مبدأ: ${p.title ?? ""}${p.snippet ? " — " + p.snippet.slice(0, 200) : ""}`.trim());
  return [...rul, ...prin].filter((l) => l && l !== "- حكم:" && l !== "- مبدأ:").join("\n");
}

/** يبثّ إجابة الموجّه حيًّا: خطوات البحث ثمّ التوليد المتدفّق من النموذج، ثمّ الختام. */
export async function* streamAsk(question: string, kase: JudicialCase | null, actorId?: string): AsyncGenerator<AskStreamEvent> {
  const requestId = randomUUID();

  // ① حارس التحيّة — ردٌّ ودّيّ مبثوثٌ كلمةً كلمةً، بلا تأصيل.
  if (isSmalltalk(question)) {
    const answer = `${GREETING}\n${kase ? GREETING_INVITE_CASE : GREETING_INVITE_GENERAL}`;
    yield { type: "stage", label: "تحيّة", state: "done" };
    for (const w of answer.split(/(\s+)/)) if (w) yield { type: "delta", text: w };
    yield { type: "done", blocked: false, citations: [], notice: "تحيّةٌ طيّبة — في انتظار مسألتك القضائيّة.", answer, requestId, greeting: true };
    return;
  }

  // ② بحثٌ في مستندات القضية (سياقٌ يُحقَن في التوليد).
  if (kase && kase.attachments.length) yield { type: "stage", label: "أبحث في مستنداتك", state: "active" };
  const passages = kase ? await retrieveCasePassages(kase, question, 6).catch(() => []) : [];
  if (kase && kase.attachments.length) yield { type: "stage", label: passages.length ? `بحثتُ مستنداتك: ${passages.length} مقطعًا ذا صلة` : "بحثتُ مستنداتك", state: "done" };

  // ③ تأصيلٌ سريع بالنواة (لا وضع «عميق» — كي يكتمل ضمن المهلة).
  yield { type: "stage", label: "أبحث في النواة القانونيّة", state: "active" };
  const caseCtx = kase ? caseContext(kase, passages) : "";
  const agentQuery = [`مسألة القاضي: ${question.trim()}`, caseCtx].filter(Boolean).join("\n\n");
  const agent = await runCaseAgent(agentQuery).catch(() => null);
  const articles = agent?.articles ?? [];
  const grounded = Boolean(agent?.grounded && articles.length);
  yield { type: "stage", label: grounded ? `وجدتُ ${articles.length} مادّة مؤصِّلة` : "لا مادّة مطابقة — أعتمد مستنداتك", state: "done" };
  const citations: AskCitation[] = articles.slice(0, 8).map((a) => ({ articleId: a.articleId, lawName: a.systemName, articleNumber: a.articleNumber, quote: a.articleText.slice(0, 350) }));

  // ④ التوليد المتدفّق من النموذج (بثٌّ حقيقيّ).
  const system = [
    JUDICIAL_PROMPT,
    grounded
      ? "استند حصريًّا لمواد النواة المرفقة عند الاستشهاد النظاميّ، ولا تخترع مادّةً أو رقم مادة. الأحكام والمبادئ سياقٌ استئناسيّ للترجيح لا للاستشهاد بأرقامٍ منها."
      : "لا تتوفّر مادّةٌ نظاميّة مطابقة في النواة؛ أجب من مستندات القضية ووقائعها فقط وصرّح بذلك، ولا تخترع مادّةً أو رقم مادة.",
  ].join("\n");
  const support = grounded ? supportingBlock(agent) : "";
  const user = [
    `مسألة القاضي:\n${question.trim()}`,
    caseCtx ? `سياق القضية:\n${caseCtx}` : "",
    grounded ? agent!.groundingText : "",
    support ? `سياقٌ قضائيّ استئناسيّ (أحكام ومبادئ — لتوجيه الترجيح فقط):\n${support}` : "",
  ].filter(Boolean).join("\n\n");

  const cfg = await resolveAiConfig();
  if (cfg.provider === "offline" || !cfg.apiKey) {
    if (!grounded && !caseCtx) {
      yield { type: "done", blocked: true, citations: [], notice: "مزوّد النموذج غير مضبوط، ولا مادّة قضيّةٍ لعرضها.", answer: "", requestId };
      return;
    }
    const text = (grounded ? citations.map((c) => `- ${c.lawName}، المادة ${c.articleNumber}: ${c.quote}`).join("\n") : caseCtx.slice(0, 3000));
    for (const w of text.split(/(\s+)/)) if (w) yield { type: "delta", text: w };
    yield { type: "done", blocked: false, citations: grounded ? citations : [], notice: "مزوّد النموذج غير مضبوط — عُرضت المادّة المتاحة.", answer: text, requestId };
    return;
  }

  yield { type: "stage", label: "أصوغ التحليل", state: "active" };
  let acc = "";
  try {
    for await (const chunk of streamWithConfig(cfg, system, user, 6000)) { acc += chunk; yield { type: "delta", text: chunk }; }
  } catch {
    /* يُعرَض ما تجمّع */
  }
  yield { type: "stage", label: "صغتُ التحليل", state: "done" };
  const answer = acc.trim() || (grounded ? citations.map((c) => `- ${c.lawName}، المادة ${c.articleNumber}: ${c.quote}`).join("\n") : caseCtx.slice(0, 2000));
  yield {
    type: "done",
    blocked: !answer,
    citations: grounded ? citations : [],
    notice: grounded ? NOTICE_OK : NOTICE_CASE,
    answer,
    requestId,
  };
}

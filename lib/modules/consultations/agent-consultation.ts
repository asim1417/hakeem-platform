// مسوّدة الاستشارة عبر وكيل الأنظمة الكامل (ترقية الخدمة الصفراء «consultations»).
// يرفع الاستشارة من «بحث لقطة واحدة» (buildLegalContextForAI) إلى مستوى «اسأل حكيم»: فهم
// النظام الحاكم (resolve-scope) + الاسترجاع المقيّد + التحقّق، ثم صياغة استشارة تعليمية بوضع
// الاستشارة. لا يمسّ createConsultationDraft (المشتركة مع «اسأل حكيم») ولا المصادقة ولا النواة.
//
// يعيد نفس شكل مخرَج createConsultationDraft كي تعمل صفحة الاستشارات دون تغيير واجهتها.
import { randomUUID } from "crypto";
import { recordGuardrail } from "@/lib/modules/audit/audit";
import { noLegalArticleMessage } from "@/lib/modules/legal-core/legal-retrieval";
import { guardOutputAgainstUnknownArticleNumbers } from "@/lib/modules/legal-core/legal-citation-guard";
import { callCentralProvider } from "@/lib/modules/ai/ai-gateway";
import { sanitizeForModel } from "@/lib/modules/legal-chat/redaction";

export interface AgentConsultationResult {
  requestId: string;
  blocked: boolean;
  output: string;
  citations: Array<{ articleId: string; lawName: string; articleNumber: number; quote: string }>;
  qualityReport: Record<string, unknown>;
  provider: string;
  mode: "offline" | "live";
}

const PRO_DISCLAIMER =
  "تنبيه مهني: هذه المخرجات مساعدة أولية ولا تعد رأيًا قانونيًا نهائيًا أو بديلًا عن مراجعة محامٍ مختص.";

/** تعليمة وضع الاستشارة: يحوّل الواقعة إلى استشارة تعليمية مؤصّلة حصريًا بمواد النظام الحاكم. */
function buildConsultationSystemPrompt(): string {
  return [
    "أنت مستشار قانوني تعليمي سعودي منضبط بالمصادر داخل منصة حكيم.",
    "حوّل الواقعة إلى استشارة تعليمية مؤصّلة: (١) وصف المسألة قانونيًا، (٢) المواد النظامية الحاكمة، (٣) التوجيه العملي.",
    "استند حصريًا للمواد المرفقة من النواة القانونية. لا تذكر مادة ليست فيها، ولا رقم مادة غير وارد في نصّها المرفق.",
    // نفس قاعدة «اسأل حكيم» (synthesizeWithMode): الأحكام والمبادئ سياقٌ استئناسيّ لا مصدرٌ لأرقام المواد.
    "الأحكام والمبادئ المرفقة (إن وُجدت) سياقٌ قضائيّ استئناسيّ لتوجيه التحليل والترجيح؛ لا تستشهد منها بأرقام مواد — السند النظاميّ الوحيد للأرقام هو المواد المرفقة.",
    "إن لم تكفِ المواد المرفقة فصرّح بذلك صراحةً بدل الاختلاق.",
    "اكتب بالعربية بأسلوب منظّم، وأضِف تنبيهًا مهنيًا في الختام.",
  ].join("\n");
}

/** سياقٌ قضائيّ استئناسيّ من أحكام النواة ومبادئها (كما يفعل «اسأل حكيم») — لتوجيه التحليل، لا للاستشهاد بأرقام مواد. */
function buildSupportingBlock(agent: { rulings?: Array<{ title?: string; snippet?: string }>; principles?: Array<{ title?: string; snippet?: string }> }): string {
  const rul = (agent.rulings ?? []).slice(0, 6).map((r) => `- حكم: ${r.title ?? ""}${r.snippet ? " — " + r.snippet.slice(0, 220) : ""}`.trim());
  const prin = (agent.principles ?? []).slice(0, 6).map((p) => `- مبدأ: ${p.title ?? ""}${p.snippet ? " — " + p.snippet.slice(0, 220) : ""}`.trim());
  return [...rul, ...prin].filter((l) => l && l !== "- حكم:" && l !== "- مبدأ:").join("\n");
}

const CASE_FACTS_NOTE = "\n\n— أُنجز هذا من مستندات قضيتك ووقائعها؛ لم يُطابَق سندٌ نظاميّ في النواة بعد (فلا استشهاد نظاميّ).";

/**
 * سقوطٌ على مادّة القضية: يُنجز المطلوب (تلخيص/دراسة/عمل) من نصّ المدخل نفسه — الذي يحمل
 * مستندات القضية ووقائعها — دون اختلاق مادّةٍ نظاميّة أو رقم مادة. مُعلَّمٌ بوضوح أنّه من
 * مستندات القضية لا النواة. سقوطٌ حتميّ لعرض المادّة الخام عند تعذّر النموذج.
 */
async function synthesizeFromFacts(facts: string, requestId: string): Promise<AgentConsultationResult> {
  const system = [
    "أنت المعاون القضائيّ في منصّة حكيم. أنجِز المطلوب أدناه اعتمادًا على مادّة القضية (المستندات والوقائع) الواردة في النصّ **فقط**.",
    "لا تُصدر حكمًا نهائيًّا، ولا تخترع مادّةً نظاميّة أو رقم مادةٍ من الذاكرة. إن استلزم العمل سندًا نظاميًّا ولم يُتَح فصرّح بذلك صراحةً.",
    "انسب كلّ واقعةٍ لمصدرها، وميّز الثابت عن المُدّعى. اكتب بالعربية بأسلوبٍ قضائيّ منظّم.",
  ].join("\n");
  const llm = await callCentralProvider({ systemPrompt: system, userPrompt: facts, maxTokens: 1600 }).catch(() => null);
  if (llm?.ok && llm.content.trim()) {
    return {
      requestId, blocked: false, output: `${llm.content}${CASE_FACTS_NOTE}`, citations: [],
      provider: llm.provider, mode: "live",
      qualityReport: { sourceOfTruth: "case_documents", agent: true, fallback: "facts" },
    };
  }
  // لا مفتاح نموذج: نعرض مادّة القضية كما وردت (لا اختلاق).
  return {
    requestId, blocked: false, output: `${facts.slice(0, 3500)}${CASE_FACTS_NOTE}`, citations: [],
    provider: "offline", mode: "offline",
    qualityReport: { sourceOfTruth: "case_documents", agent: true, fallback: "facts-raw" },
  };
}

/** استشارة احتياطية مبنيّة حصريًا على المواد المُتحقَّقة (بلا نموذج) — لا اختلاق. */
function offlineConsultation(citations: AgentConsultationResult["citations"]): string {
  return [
    PRO_DISCLAIMER,
    "",
    "١. المواد النظامية الحاكمة (من النواة):",
    ...citations.map((c) => `- ${c.lawName}، المادة ${c.articleNumber}: ${c.quote}`),
    "",
    "٢. التوجيه:",
    "يُبنى التوجيه على المواد أعلاه فقط لأنها الثابتة في النواة القانونية. راجِع المستندات والبيّنات قبل اعتماد أي مسار.",
  ].join("\n");
}

/**
 * ينشئ مسوّدة استشارة مؤرَّضة بوكيل الأنظمة. سقوط آمن إلى الحجب الصادق عند غياب السند،
 * وإلى الاستشارة الاحتياطية عند تعذّر النموذج أو رصد رقم مادة غير مؤرَّض في المخرَج.
 */
export async function createAgentConsultationDraft(input: { facts: string; actorId?: string; fallbackToFacts?: boolean }): Promise<AgentConsultationResult> {
  const requestId = randomUUID();
  const { runCaseAgent } = await import("@/lib/modules/agents/case-agent-bridge");
  const agent = await runCaseAgent(input.facts).catch(() => null);
  const articles = agent?.articles ?? [];

  // حارس السند: لا مواد من النواة.
  if (!agent?.grounded || !articles.length) {
    await recordGuardrail({
      subject: "AI_GATEWAY",
      requestId,
      guardName: "legal-core-citations-only",
      result: "BLOCKED",
      details: { message: noLegalArticleMessage, retrievedArticles: 0, provider: "agent" },
    }).catch(() => undefined);
    // خدمات المعاون: بدل الامتناع الكامل، أنجِز المطلوب من **مادّة القضية نفسها** (مستندات/وقائع)
    // بلا اختلاق مادّةٍ نظاميّة — لأنّ ملخّص/دراسة القضية يُبنى على مستندات المستخدم لا النواة.
    if (input.fallbackToFacts) return synthesizeFromFacts(input.facts, requestId);
    return {
      requestId,
      blocked: true,
      output: noLegalArticleMessage,
      citations: [],
      provider: "agent",
      mode: "offline",
      qualityReport: { sourceOfTruth: "legal_core.legal_articles", agent: true, guard: "no-articles" },
    };
  }

  const citations = articles.slice(0, 8).map((a) => ({
    articleId: a.articleId,
    lawName: a.systemName,
    articleNumber: a.articleNumber,
    quote: a.articleText.slice(0, 350),
  }));

  await recordGuardrail({
    subject: "AI_GATEWAY",
    requestId,
    guardName: "legal-core-citations-only",
    result: "PASSED",
    details: { retrievedArticles: articles.length, governingSystems: agent.governingSystems.slice(0, 3).map((g) => g.systemName), provider: "agent" },
  }).catch(() => undefined);

  // PDPL ④: تُعمّى معرّفات الأطراف من الواقعة قبل الإرسال للنموذج (السياق النظامي محلّي فيبقى).
  const modelFacts = sanitizeForModel(input.facts).text;
  // سياقٌ قضائيّ استئناسيّ (أحكام + مبادئ من النواة) — نفس ما يمرّره «اسأل حكيم» في الصياغة.
  const supportingBlock = buildSupportingBlock(agent);
  const userPrompt = [
    `الواقعة:\n${modelFacts}`,
    agent.groundingText,
    supportingBlock
      ? `سياقٌ قضائيّ استئناسيّ (أحكام ومبادئ من النواة — لتوجيه التحليل والترجيح فقط، لا للاستشهاد بأرقام مواد منها):\n${supportingBlock}`
      : "",
  ].filter(Boolean).join("\n\n");
  const llm = await callCentralProvider({
    systemPrompt: buildConsultationSystemPrompt(),
    userPrompt,
    maxTokens: 1300,
  }).catch(() => ({ ok: false as const, content: "", mode: "offline" as const, provider: "offline" }));

  let output: string;
  let mode: "offline" | "live";
  let provider: string;
  if (llm.ok && llm.content.trim()) {
    // حارس التلفيق: أيّ رقم مادة في المخرَج ليس ضمن المسترجَع ⇒ استبدال بالاحتياطي المؤرَّض.
    const guard = guardOutputAgainstUnknownArticleNumbers(llm.content, articles);
    output = guard.ok ? `${llm.content}\n\n${PRO_DISCLAIMER}` : offlineConsultation(citations);
    mode = "live";
    provider = llm.provider;
  } else {
    output = offlineConsultation(citations);
    mode = "offline";
    provider = "offline";
  }

  return {
    requestId,
    blocked: false,
    output,
    citations,
    provider,
    mode,
    qualityReport: {
      sourceOfTruth: "legal_core.legal_articles",
      agent: true,
      mode,
      retrievedArticles: articles.length,
      verified: agent.verified.length,
      governingSystems: agent.governingSystems.slice(0, 3).map((g) => g.systemName),
    },
  };
}

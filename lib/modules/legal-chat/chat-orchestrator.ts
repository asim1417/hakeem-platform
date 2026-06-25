// ─────────────────────────────────────────────────────────────────────────────
// ChatOrchestrator — قلب الشات القضائي الذكي.
// يفرض المسار: فهم → تأكيد → استكمال نواقص → استرجاع مصادر → تحليل → صياغة → مراجعة.
// لا ينتقل من السؤال إلى الإنتاج النهائي عالي المخاطر مباشرةً دون بطاقة فهم وموافقة.
// يجمّع كل المحركات ويبني بطاقات الردّ، مع حوكمة دائمة ومنع هلوسة.
// ─────────────────────────────────────────────────────────────────────────────
import { analyzeCase } from "@/lib/modules/case-analysis/case-analysis-engine";
import type { CaseAnalysisResult } from "@/lib/modules/case-analysis/types";
import { resolveAiProvider } from "@/lib/modules/ai/ai-provider";
import type {
  ChatCard,
  ChatTurnInput,
  ChatTurnResult,
  GroundedSource,
  IntentResult,
  SimulationCaseFile,
} from "./types";
import { detectIntent } from "./user-intent-engine";
import { buildCaseFileFromIntent, mergeIntentIntoCaseFile } from "./case-file";
import { buildUnderstandingCard, canProduce } from "./understanding-engine";
import { buildProcedureMap } from "./judicial-procedure-engine";
import {
  buildArgumentMap,
  buildConfidenceScore,
  buildEvidencePlan,
  buildIssuesList,
  buildNextBestActions,
  buildTimeline,
} from "./evidence-logic-engine";
import { buildLegalOutput, TRAINING_DISCLAIMER } from "./drafting-style-engine";
import { groundQuery } from "./anti-hallucination";
import { OUTPUT_LABELS } from "./taxonomy";
import {
  buildArbitrationSimulation,
  buildJudgeSimulation,
  buildOpponentSimulation,
} from "./role-simulations";
import { analyzeDocuments, reviewContract } from "./document-analysis";
import { buildExplain, buildStrategyComparison } from "./strategy";
import { matchPlaybook, matchWorkflow, runWorkflow } from "./workflows";
import { redactSections } from "./redaction";

/** هل المخرج المطلوب «قابل للصياغة» كوثيقة قضائية؟ */
function isDraftableOutput(intent: IntentResult): boolean {
  return [
    "CLAIM_SHEET",
    "ANSWER_MEMO",
    "REPLY_MEMO",
    "OBJECTION",
    "APPEAL_MEMO",
    "CASSATION_MEMO",
    "RECONSIDERATION_MEMO",
    "DRAFT_JUDGMENT",
    "CRIMINAL_DEFENSE",
    "ARBITRATION_AWARD",
    "ARBITRATION_ORDER",
  ].includes(intent.requestedOutput);
}

/** يبني استعلام الاسترجاع من ملف القضية والنيّة. */
function retrievalQuery(intent: IntentResult, caseFile: SimulationCaseFile): string {
  const parts = [intent.disputeType, caseFile.facts.map((f) => f.text).join(" "), intent.claims ?? ""];
  return parts.filter(Boolean).join(" ").slice(0, 1000);
}

/** يبني نص ردّ حكيم (لغة محادثة، لا قضائية) بحسب حالة الدورة. */
function buildReply(
  intent: IntentResult,
  awaiting: boolean,
  produced: boolean,
  isDraft: boolean
): string {
  if (awaiting) {
    const lines = [
      `فهمت من رسالتك ما يلي — أعرضه عليك للتأكيد قبل أن أُنتج أي مخرج نهائي.`,
    ];
    if (intent.missingInfo.some((m) => m.critical)) {
      lines.push("لاحظتُ نواقص مؤثّرة سأبيّنها في بطاقة الفهم؛ يمكنك استكمالها أو طلب مسودة أولية مع الافتراضات.");
    }
    lines.push("راجع بطاقة «فهم الطلب» ثم اختر: تابع، أو عدّل، أو أضف معلومات.");
    return lines.join("\n");
  }
  if (produced) {
    const head = isDraft
      ? `أنشأت مسودة أولية لـ«${OUTPUT_LABELS[intent.requestedOutput]}» مع بيان الافتراضات صراحةً.`
      : `أعددت ${OUTPUT_LABELS[intent.requestedOutput]} بمنهج قضائي مُسنَد إلى النواة القانونية.`;
    return `${head}\nالمخرج مسودة تحتاج مراجعة بشرية قبل الاعتماد، وكل إسناد فيه مأخوذ من النواة المتحقَّقة.`;
  }
  return "أعددت تحليلاً أولياً لقضيتك مع الأساس النظامي من النواة. أخبرني بالمخرج الذي تريده (مذكرة، حكم افتراضي، خطة إثبات…).";
}

/**
 * تشغيل دورة شات واحدة.
 */
export async function runChatTurn(input: ChatTurnInput): Promise<ChatTurnResult> {
  const documentsCount = input.attachments?.length ?? 0;
  const intent = await detectIntent(input.message, documentsCount);

  // ١) ملف القضية الحيّ.
  const caseFile: SimulationCaseFile = input.caseFile
    ? mergeIntentIntoCaseFile(input.caseFile, intent)
    : buildCaseFileFromIntent(intent);

  // ٢) بوابة الإنتاج: هل نحتاج تأكيد فهم؟
  const gate = canProduce(intent, input.approval ?? null);
  const card = buildUnderstandingCard(intent, input.approval ?? null, caseFile, documentsCount);

  const cards: ChatCard[] = [];
  const aiMeta = await resolveAiProvider().catch(() => ({ name: "offline", model: "" }));

  // إذا لم يُسمح بالإنتاج بعد (مخرج عالي المخاطر بلا موافقة/اكتمال) → اعرض بطاقة الفهم وانتظر.
  const awaiting = !gate.allowed;
  if (awaiting) {
    cards.push({ type: "UNDERSTANDING", understanding: card });
    cards.push({ type: "CASE_FILE", caseFile });
    cards.push({ type: "GOVERNANCE", governance: [TRAINING_DISCLAIMER, card.blockReason ?? ""].filter(Boolean) });
    return {
      reply: buildReply(intent, true, false, false),
      cards,
      intent,
      caseFile,
      awaitingConfirmation: true,
      trainingDisclaimer: TRAINING_DISCLAIMER,
      provider: aiMeta.name,
      model: aiMeta.model,
      generated: intent.source !== "deterministic",
    };
  }

  // ٣) الاسترجاع من النواة (إسناد ومنع هلوسة).
  const grounding = await groundQuery(retrievalQuery(intent, caseFile), {
    strength: input.searchStrength,
  });
  const sources: GroundedSource[] = grounding.sources;

  // ٤) التحليل (best-effort — قد تكون القاعدة غير مفعّلة).
  let analysis: CaseAnalysisResult | null = null;
  try {
    analysis = await analyzeCase({
      facts: intent.facts,
      claims: intent.claims ?? undefined,
      defenses: intent.defenses ?? undefined,
      documents: input.attachments?.map((a) => `${a.fileName}${a.declaredKind ? ` (${a.declaredKind})` : ""}`),
      caseType: caseFile.track,
    });
  } catch {
    analysis = null;
  }

  // ٥) بطاقة ملف القضية + الفهم (مؤكَّد الآن).
  cards.push({ type: "UNDERSTANDING", understanding: card });
  cards.push({ type: "CASE_FILE", caseFile });

  // ٦) المنطق الإجرائي + المسائل.
  const procedure = buildProcedureMap(intent);
  const issues = buildIssuesList(intent, analysis, sources);
  cards.push({ type: "ISSUES", issues });

  // ٧) الإثبات + الحجج + الخط الزمني (للمخرجات التحليلية ومخرجات الصياغة).
  cards.push({ type: "EVIDENCE_PLAN", evidencePlan: buildEvidencePlan(intent, caseFile, analysis) });
  cards.push({ type: "ARGUMENT_MAP", argumentMap: buildArgumentMap(intent, analysis) });
  cards.push({ type: "TIMELINE", timeline: buildTimeline(caseFile) });

  // ٨) درجة الثقة القانونية.
  const confidence = buildConfidenceScore(intent, caseFile, analysis, sources);
  cards.push({ type: "CONFIDENCE", confidence });

  // ٨-أ) محاكاة الأدوار بحسب النمط/المخرج (الخصم/القاضي/المحكّم).
  if (input.mode === "OPPONENT" || intent.requestedOutput === "OPPONENT_DEFENSES") {
    cards.push({ type: "OPPONENT", opponent: buildOpponentSimulation(intent, caseFile, analysis) });
  }
  if (input.mode === "JUDGE" || intent.requestedOutput === "DRAFT_JUDGMENT" || intent.requestedOutput === "HEARING_SIMULATION") {
    cards.push({ type: "JUDGE_VIEW", judge: buildJudgeSimulation(intent, caseFile, analysis, sources) });
  }
  if (
    input.mode === "ARBITRATOR" ||
    intent.track === "ARBITRATION" ||
    intent.requestedOutput === "ARBITRATION_AWARD" ||
    intent.requestedOutput === "ARBITRATION_ORDER" ||
    intent.requestedOutput === "ARBITRATION_CLAUSE_CHECK"
  ) {
    cards.push({ type: "ARBITRATION_VIEW", arbitration: buildArbitrationSimulation(intent, caseFile, analysis) });
  }

  // ٨-ب) تحليل المستندات (بعد تحديد نوعها) + مراجعة العقد عند توفّر نصّه.
  const analyzable = (input.attachments ?? []).filter((a) => a.declaredKind && (a.content ?? "").trim());
  if (analyzable.length > 0) {
    cards.push({ type: "DOC_ANALYSIS", docAnalysis: analyzeDocuments(input.attachments ?? []) });
  }
  if (input.mode === "CONTRACT_EXAMINER" || intent.requestedOutput === "CONTRACT_REVIEW") {
    const contractText = analyzable.map((a) => a.content ?? "").join("\n") || (intent.facts.length > 120 ? intent.facts : "");
    cards.push({ type: "CONTRACT_REVIEW", contractReview: reviewContract(contractText) });
  }

  // ٨-ج) مقارنة الاستراتيجيات + شرح النتيجة (تحليلي).
  cards.push({ type: "COMPARE_STRATEGIES", strategies: buildStrategyComparison(intent) });
  cards.push({ type: "EXPLAIN", explain: buildExplain(intent, caseFile, analysis, sources) });

  // ٨-د) مسار العمل القانوني / Playbook المطابق.
  const wfDef = matchWorkflow(intent);
  if (wfDef) {
    cards.push({ type: "WORKFLOW", workflow: runWorkflow(wfDef, caseFile, intent) });
  }
  const playbook = matchPlaybook(intent);

  // ٩) الصياغة القضائية (للمخرجات القابلة للصياغة) — مع إخفاء البيانات الحساسة اختيارياً.
  let produced = false;
  if (isDraftableOutput(intent)) {
    const output = buildLegalOutput({
      intent,
      caseFile,
      sources,
      isDraftWithAssumptions: gate.isDraftWithAssumptions,
      assumptions: [],
      extraGovernance: [...procedure.notes, ...(playbook ? [`Playbook مُطبّق: ${playbook.name}`] : [])],
    });
    output.nextBestActions = buildNextBestActions(intent, caseFile);
    if (input.redact) {
      const r = redactSections(output.sections, "PARTIAL");
      output.sections = r.sections;
      if (r.redactedCount > 0) {
        output.governanceNotes.push(`أُخفيت ${r.redactedCount} بيانات حساسة (${r.categories.join("، ")}) قبل العرض/التصدير.`);
      }
    }
    cards.push({ type: "OUTPUT", output });
    produced = true;
  }

  // ١٠) حوكمة دائمة.
  cards.push({
    type: "GOVERNANCE",
    governance: [
      TRAINING_DISCLAIMER,
      grounding.note,
      "يلزم مراجعة المخرج من مختص قبل الاعتماد عليه. المخرجات الاحتمالية لا تقدّم ضماناً بنتيجة قضائية.",
    ],
  });

  return {
    reply: buildReply(intent, false, produced, gate.isDraftWithAssumptions),
    cards,
    intent,
    caseFile,
    awaitingConfirmation: false,
    trainingDisclaimer: TRAINING_DISCLAIMER,
    provider: aiMeta.name,
    model: aiMeta.model,
    generated: intent.source !== "deterministic",
  };
}

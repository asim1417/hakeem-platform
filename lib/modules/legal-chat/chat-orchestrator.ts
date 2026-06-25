// ─────────────────────────────────────────────────────────────────────────────
// ChatOrchestrator — قلب الشات القضائي الذكي (Chat-First).
// القاعدة: الشات هو الطريق، التقرير هو النتيجة، والاسترجاع لا يبدأ إلا بعد فهم المسألة.
// المسار: فهم الإنسان → حوار وأسئلة → اكتمال الحد الأدنى → عرض «اقتراح التقرير» →
//         بعد موافقة المستخدم فقط: استرجاع مُسنَد + تحليل + بطاقات التقرير + صياغة.
// لا قضية = لا تحليل · لا مسألة = لا مصادر · لا تقرير قبل موافقة المستخدم.
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
import { detectIntent, detectIntentDeterministic, intentFromCaseFile } from "./user-intent-engine";
import { classifyConversation, detectReportRequest, baseStage, type ConversationStage } from "./conversation-engine";
import { buildCaseFileFromIntent, isCaseSubstantive, mergeIntentIntoCaseFile } from "./case-file";
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
import { OUTPUT_LABELS, ROLE_LABELS, TRACK_LABELS } from "./taxonomy";
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
    "CLAIM_SHEET", "ANSWER_MEMO", "REPLY_MEMO", "OBJECTION", "APPEAL_MEMO",
    "CASSATION_MEMO", "RECONSIDERATION_MEMO", "DRAFT_JUDGMENT", "CRIMINAL_DEFENSE",
    "ARBITRATION_AWARD", "ARBITRATION_ORDER",
  ].includes(intent.requestedOutput);
}

/** يبني استعلام الاسترجاع من ملف القضية والنيّة. */
function retrievalQuery(intent: IntentResult, caseFile: SimulationCaseFile): string {
  const parts = [intent.disputeType, caseFile.facts.map((f) => f.text).join(" "), intent.claims ?? ""];
  return parts.filter(Boolean).join(" ").slice(0, 1000);
}

/** قيم نتيجة موحّدة لتقليل التكرار. */
function result(args: {
  reply: string;
  cards: ChatCard[];
  intent: IntentResult;
  caseFile: SimulationCaseFile | null;
  awaiting: boolean;
  provider: { name: string; model: string };
  generated: boolean;
  conv: { messageType: string; understandingStage: string; userLevel: string };
  suggestedButtons: string[];
  conversational: boolean;
  stage: ConversationStage;
}): ChatTurnResult {
  return {
    reply: args.reply,
    cards: args.cards,
    intent: args.intent,
    caseFile: args.caseFile,
    awaitingConfirmation: args.awaiting,
    trainingDisclaimer: TRAINING_DISCLAIMER,
    provider: args.provider.name,
    model: args.provider.model,
    generated: args.generated,
    messageType: args.conv.messageType,
    understandingStage: args.conv.understandingStage,
    userLevel: args.conv.userLevel,
    suggestedButtons: args.suggestedButtons,
    conversational: args.conversational,
    stage: args.stage,
  };
}

/** رسالة «اقتراح التقرير» بعد اكتمال الحد الأدنى (لا تظهر بطاقات بعد). */
function reportReadyReply(cf: SimulationCaseFile): string {
  const role = ROLE_LABELS[cf.userRole];
  const track = TRACK_LABELS[cf.track];
  const lines = [
    `فهمت أن النزاع يدور حول ${cf.disputeType} (${track})، وأن صفتك: ${role}.`,
  ];
  if (cf.defenses) lines.push(`ودفاعك الأساسي يدور حول: ${cf.defenses}.`);
  lines.push(
    "أستطيع الآن إعداد تقرير قضية أولي يتضمّن: ملخص الوقائع، المسائل القانونية، خطة الإثبات، الدفوع المحتملة، الأحكام المشابهة (عند تفعيلها)، والخطوة التالية."
  );
  lines.push("هل تريد عرض التقرير الأولي الآن؟");
  return lines.join("\n");
}

const REPORT_READY_BUTTONS = [
  "نعم، اعرض التقرير",
  "اسألني قبل التقرير",
  "صغ مذكرة جوابية",
  "اعرض خطة إثبات فقط",
  "اعرض الأحكام المشابهة فقط",
];

/**
 * تشغيل دورة شات واحدة (Chat-First).
 */
export async function runChatTurn(input: ChatTurnInput): Promise<ChatTurnResult> {
  const documentsCount = input.attachments?.length ?? 0;
  const det = detectIntentDeterministic(input.message, documentsCount);
  const conv = classifyConversation(input.message, det, !!input.caseFile);
  const reportReq = detectReportRequest(input.message);
  const aiMeta = await resolveAiProvider().catch(() => ({ name: "offline", model: "" }));
  const convInfo = { messageType: conv.messageType, understandingStage: conv.stage, userLevel: conv.userLevel };

  // راكم ملف القضية (Case Memory) — لا تنشئ ملفاً عند التحية المجرّدة.
  const mergedCase: SimulationCaseFile | null = input.caseFile
    ? mergeIntentIntoCaseFile(input.caseFile, det)
    : conv.stage !== "GreetingOnly" && conv.stage !== "NonLegalSmallTalk"
      ? buildCaseFileFromIntent(det)
      : null;

  const substantive = !!mergedCase && (isCaseSubstantive(mergedCase) || conv.runAnalysis);
  const askedReport = reportReq.show || reportReq.partial !== null || reportReq.draft || !!input.approval;

  // ── الطور الحواري: تحية/دردشة/إشارة ضعيفة/نيّة ناقصة → شات فقط (بلا بطاقات/استرجاع) ──
  if (!substantive) {
    return result({
      reply: conv.reply,
      cards: [],
      intent: det,
      caseFile: mergedCase,
      awaiting: true,
      provider: aiMeta,
      generated: false,
      conv: convInfo,
      suggestedButtons: conv.suggestedButtons,
      conversational: true,
      stage: baseStage(conv.stage),
    });
  }

  // ── اكتمل الحد الأدنى، لكن لم يطلب المستخدم التقرير بعد → اقترح التقرير (لا بطاقات) ──
  if (substantive && mergedCase && !askedReport) {
    return result({
      reply: reportReadyReply(mergedCase),
      cards: [],
      intent: det,
      caseFile: mergedCase,
      awaiting: true,
      provider: aiMeta,
      generated: false,
      conv: { ...convInfo, understandingStage: "AnalysisReady" },
      suggestedButtons: REPORT_READY_BUTTONS,
      conversational: true,
      stage: "report_ready",
    });
  }

  // ── Report Mode: المستخدم وافق/طلب التقرير على قضية مكتملة → استرجاع + تحليل + بطاقات ──
  return buildReportTurn(input, mergedCase as SimulationCaseFile, reportReq, aiMeta, convInfo);
}

/** يبني تقرير القضية الكامل (أو جزءاً منه) بعد موافقة المستخدم. */
async function buildReportTurn(
  input: ChatTurnInput,
  caseFile: SimulationCaseFile,
  reportReq: { show: boolean; partial: "evidence" | "similar" | "strategies" | null; draft: boolean },
  aiMeta: { name: string; model: string },
  convInfo: { messageType: string; understandingStage: string; userLevel: string }
): Promise<ChatTurnResult> {
  // نيّة التحليل تُبنى من ملف القضية المتراكم (لا من رسالة «نعم اعرض التقرير»).
  let intent = intentFromCaseFile(caseFile);
  // إن حملت الرسالة الحالية وقائع جديدة جوهرية، أثرِ النيّة بمزوّد الذكاء.
  if (input.message.trim().length > 60) {
    try {
      intent = mergeIntent(intent, await detectIntent(input.message, input.attachments?.length ?? 0));
    } catch {
      /* أبقِ النيّة الحتمية */
    }
  }
  if (reportReq.draft && !isDraftableOutput(intent)) intent = { ...intent, requestedOutput: "ANSWER_MEMO" };

  const cards: ChatCard[] = [];

  // الاسترجاع المُسنَد (مع SourceRelevanceGate ومنع المواد غير المرتبطة).
  const grounding = await groundQuery(retrievalQuery(intent, caseFile), { strength: input.searchStrength });
  const sources: GroundedSource[] = grounding.sources;

  // التحليل (best-effort).
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

  // عرض جزئي عند طلبه (خطة إثبات فقط / أحكام مشابهة فقط / استراتيجيات فقط).
  if (reportReq.partial === "evidence") {
    cards.push({ type: "EVIDENCE_PLAN", evidencePlan: buildEvidencePlan(intent, caseFile, analysis) });
    cards.push(governanceCard(grounding.note));
    return reportResult("هذه خطة الإثبات فقط كما طلبت.", cards, intent, caseFile, aiMeta, convInfo);
  }
  if (reportReq.partial === "strategies") {
    cards.push({ type: "COMPARE_STRATEGIES", strategies: buildStrategyComparison(intent) });
    cards.push(governanceCard(grounding.note));
    return reportResult("هذه مقارنة الاستراتيجيات فقط كما طلبت.", cards, intent, caseFile, aiMeta, convInfo);
  }
  if (reportReq.partial === "similar") {
    cards.push({ type: "ISSUES", issues: buildIssuesList(intent, analysis, sources) });
    cards.push(governanceCard(sources.length ? grounding.note : "لم تُسترجع أحكام مشابهة مرتبطة بدرجة صلة كافية."));
    return reportResult("هذه أقرب المسائل/الأحكام المرتبطة كما طلبت.", cards, intent, caseFile, aiMeta, convInfo);
  }

  // التقرير الكامل.
  const gate = canProduce(intent, input.approval ?? null);
  cards.push({ type: "UNDERSTANDING", understanding: buildUnderstandingCard(intent, input.approval ?? null, caseFile, input.attachments?.length ?? 0) });
  cards.push({ type: "CASE_FILE", caseFile });
  cards.push({ type: "ISSUES", issues: buildIssuesList(intent, analysis, sources) });
  cards.push({ type: "EVIDENCE_PLAN", evidencePlan: buildEvidencePlan(intent, caseFile, analysis) });
  cards.push({ type: "ARGUMENT_MAP", argumentMap: buildArgumentMap(intent, analysis) });
  cards.push({ type: "TIMELINE", timeline: buildTimeline(caseFile) });
  cards.push({ type: "CONFIDENCE", confidence: buildConfidenceScore(intent, caseFile, analysis, sources) });

  if (input.mode === "OPPONENT" || intent.requestedOutput === "OPPONENT_DEFENSES")
    cards.push({ type: "OPPONENT", opponent: buildOpponentSimulation(intent, caseFile, analysis) });
  if (input.mode === "JUDGE" || intent.requestedOutput === "DRAFT_JUDGMENT" || intent.requestedOutput === "HEARING_SIMULATION")
    cards.push({ type: "JUDGE_VIEW", judge: buildJudgeSimulation(intent, caseFile, analysis, sources) });
  if (input.mode === "ARBITRATOR" || intent.track === "ARBITRATION" || intent.requestedOutput === "ARBITRATION_AWARD" || intent.requestedOutput === "ARBITRATION_ORDER" || intent.requestedOutput === "ARBITRATION_CLAUSE_CHECK")
    cards.push({ type: "ARBITRATION_VIEW", arbitration: buildArbitrationSimulation(intent, caseFile, analysis) });

  const analyzable = (input.attachments ?? []).filter((a) => a.declaredKind && (a.content ?? "").trim());
  if (analyzable.length > 0) cards.push({ type: "DOC_ANALYSIS", docAnalysis: analyzeDocuments(input.attachments ?? []) });
  if (input.mode === "CONTRACT_EXAMINER" || intent.requestedOutput === "CONTRACT_REVIEW") {
    const contractText = analyzable.map((a) => a.content ?? "").join("\n") || (intent.facts.length > 120 ? intent.facts : "");
    cards.push({ type: "CONTRACT_REVIEW", contractReview: reviewContract(contractText) });
  }

  cards.push({ type: "COMPARE_STRATEGIES", strategies: buildStrategyComparison(intent) });
  cards.push({ type: "EXPLAIN", explain: buildExplain(intent, caseFile, analysis, sources) });

  const wfDef = matchWorkflow(intent);
  if (wfDef) cards.push({ type: "WORKFLOW", workflow: runWorkflow(wfDef, caseFile, intent) });
  const playbook = matchPlaybook(intent);

  // الصياغة (للمخرجات القابلة للصياغة عند السماح) — مع إخفاء اختياري.
  let produced = false;
  if (isDraftableOutput(intent) && gate.allowed) {
    const output = buildLegalOutput({
      intent,
      caseFile,
      sources,
      isDraftWithAssumptions: gate.isDraftWithAssumptions,
      assumptions: [],
      extraGovernance: [...buildProcedureMap(intent).notes, ...(playbook ? [`Playbook مُطبّق: ${playbook.name}`] : [])],
    });
    output.nextBestActions = buildNextBestActions(intent, caseFile);
    if (input.redact) {
      const r = redactSections(output.sections, "PARTIAL");
      output.sections = r.sections;
      if (r.redactedCount > 0) output.governanceNotes.push(`أُخفيت ${r.redactedCount} بيانات حساسة (${r.categories.join("، ")}) قبل العرض/التصدير.`);
    }
    cards.push({ type: "OUTPUT", output });
    produced = true;
  }

  cards.push({
    type: "GOVERNANCE",
    governance: [
      TRAINING_DISCLAIMER,
      grounding.note,
      "يلزم مراجعة المخرج من مختص قبل الاعتماد عليه. المخرجات الاحتمالية لا تقدّم ضماناً بنتيجة قضائية.",
    ],
  });

  const reply = produced
    ? `أعددت التقرير ومسودة ${OUTPUT_LABELS[intent.requestedOutput]} بمنهج قضائي مُسنَد. المخرج مسودة تحتاج مراجعة بشرية قبل الاعتماد.`
    : "هذا تقرير القضية الأولي. يمكنك طلب صياغة مذكرة، أو عرض جزء محدّد، أو استكمال نواقص.";

  return reportResult(reply, cards, intent, caseFile, aiMeta, convInfo, produced);
}

function governanceCard(note: string): ChatCard {
  return { type: "GOVERNANCE", governance: [TRAINING_DISCLAIMER, note] };
}

function reportResult(
  reply: string,
  cards: ChatCard[],
  intent: IntentResult,
  caseFile: SimulationCaseFile,
  aiMeta: { name: string; model: string },
  convInfo: { messageType: string; understandingStage: string; userLevel: string },
  generated = false
): ChatTurnResult {
  return result({
    reply,
    cards,
    intent,
    caseFile,
    awaiting: false,
    provider: aiMeta,
    generated,
    conv: { ...convInfo, messageType: "ready_for_analysis", understandingStage: "AnalysisReady" },
    suggestedButtons: [],
    conversational: false,
    stage: "report_shown",
  });
}

/** يدمج نيّة مُثراة في نيّة الأساس (يفضّل القيم المحدّدة). */
function mergeIntent(base: IntentResult, extra: IntentResult): IntentResult {
  return {
    ...base,
    userRole: base.userRole !== "UNKNOWN" ? base.userRole : extra.userRole,
    track: base.track !== "UNKNOWN" ? base.track : extra.track,
    requestedOutput: base.requestedOutput !== "UNKNOWN" ? base.requestedOutput : extra.requestedOutput,
    proceduralStage: base.proceduralStage !== "UNKNOWN" ? base.proceduralStage : extra.proceduralStage,
    disputeType: extra.disputeType && !extra.disputeType.includes("غير محدد") ? extra.disputeType : base.disputeType,
    source: "hybrid",
  };
}

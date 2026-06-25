// ─────────────────────────────────────────────────────────────────────────────
// UserIntentEngine — محرك فهم نيّة المستخدم.
// يحوّل كلام المستخدم (ولو كان عاميّاً أو غير مرتّب) إلى عناصر قانونية منظّمة:
// الصفة، المسار، نوع النزاع، المخرج المطلوب، المرحلة، الثقة، النواقص، المخاطرة.
// حتمي أولاً (يعمل دون اتصال) ثم إثراء اختياري من مزوّد الذكاء (JSON صارم).
// لا يُنتج مخرجاً قضائياً — وظيفته الفهم فقط.
// ─────────────────────────────────────────────────────────────────────────────
import { callCentralProvider } from "@/lib/modules/ai/ai-gateway";
import type {
  IntentResult,
  LegalTrack,
  MissingInfoItem,
  OutputRisk,
  ProceduralStage,
  RequestedOutput,
  SimulationCaseFile,
  UnderstandingLevel,
  UserLegalRole,
} from "./types";
import {
  ARBITRATION_CLAUSE_SIGNALS,
  HIGH_RISK_OUTPUTS,
  JUDGMENT_SIGNALS,
  KeywordRule,
  OUTPUT_RULES,
  ROLE_RULES,
  STAGE_RULES,
  TRACK_RULES,
  hasAny,
  normalizeArabic,
} from "./taxonomy";

/** يختار أعلى قاعدة مطابقة وزناً، أو القيمة الافتراضية. */
function pickRule<T>(normalized: string, rules: KeywordRule<T>[], fallback: T): { value: T; matched: boolean } {
  let best: { value: T; weight: number } | null = null;
  for (const rule of rules) {
    if (hasAny(normalized, rule.keywords)) {
      const w = rule.weight ?? 1;
      if (!best || w > best.weight) best = { value: rule.value, weight: w };
    }
  }
  return best ? { value: best.value, matched: true } : { value: fallback, matched: false };
}

/** يستخلص قيمة المطالبة (مبلغ مالي) من النص إن وُجدت. */
function extractClaimValue(text: string): string | null {
  const m = text.match(/(\d[\d,\.]{2,})\s*(ريال|ر\.?س|sar|ريالا)?/i);
  if (m) return m[0].trim();
  return null;
}

/** يحدّد نوع النزاع كنص حرّ موجز من المسار + إشارات النص. */
function describeDispute(track: LegalTrack, normalized: string): string {
  const hints: Array<[string[], string]> = [
    [["مقاوله", "مقاول"], "نزاع مقاولة"],
    [["توريد", "بضاعه"], "نزاع توريد"],
    [["ايجار"], "نزاع إيجار"],
    [["راتب", "اجور", "مكافاه"], "مطالبة عمالية"],
    [["مطالبه ماليه", "دين", "مبلغ", "فاتوره"], "مطالبة مالية"],
    [["تعويض", "ضرر"], "دعوى تعويض"],
    [["عقد"], "نزاع عقدي"],
  ];
  for (const [keys, label] of hints) if (hasAny(normalized, keys)) return label;
  const trackText: Record<LegalTrack, string> = {
    CIVIL: "نزاع مدني",
    COMMERCIAL: "نزاع تجاري",
    LABOR: "نزاع عمالي",
    CRIMINAL: "قضية جزائية",
    ADMINISTRATIVE: "نزاع إداري",
    PERSONAL_STATUS: "قضية أحوال شخصية",
    ARBITRATION: "نزاع محال للتحكيم",
    EXECUTION: "طلب تنفيذ",
    UNKNOWN: "نزاع غير محدد التكييف",
  };
  return trackText[track];
}

/** يحسب النواقص المؤثّرة بناءً على ما لم يُكتشف. */
function computeMissingInfo(args: {
  role: UserLegalRole;
  track: LegalTrack;
  output: RequestedOutput;
  stage: ProceduralStage;
  hasJudgment: boolean;
  hasArbitrationClause: boolean | null;
  facts: string;
  claims: string | null;
  documentsCount: number;
}): MissingInfoItem[] {
  const missing: MissingInfoItem[] = [];
  if (args.role === "UNKNOWN")
    missing.push({ key: "role", label: "صفتك في القضية غير واضحة", critical: true });
  if (args.track === "UNKNOWN")
    missing.push({ key: "track", label: "نوع النزاع/المسار غير واضح", critical: true });
  if (args.output === "UNKNOWN")
    missing.push({ key: "output", label: "المطلوب (نوع المخرج) غير محدد", critical: true });
  if (args.stage === "UNKNOWN")
    missing.push({ key: "stage", label: "مرحلة القضية غير معلومة", critical: false });
  if (args.facts.trim().length < 25)
    missing.push({ key: "facts", label: "الوقائع غير كافية لبناء تصور دقيق", critical: true });
  if (args.documentsCount === 0)
    missing.push({ key: "documents", label: "لا يوجد بيان بالمستندات المتاحة", critical: false });
  if (args.hasArbitrationClause === null && (args.track === "COMMERCIAL" || args.track === "CIVIL" || args.track === "ARBITRATION"))
    missing.push({ key: "arbitration", label: "غير واضح هل يوجد شرط تحكيم في العقد", critical: false });
  if (
    (args.output === "CLAIM_SHEET" || args.output === "ANSWER_MEMO") &&
    !args.claims
  )
    missing.push({ key: "claims", label: "الطلبات لم تتحدّد بدقة", critical: false });
  if (
    (args.stage === "APPEAL" || args.stage === "CASSATION" || args.output === "OBJECTION") &&
    !args.hasJudgment
  )
    missing.push({ key: "judgment", label: "بيانات الحكم المعترَض عليه (التاريخ/المنطوق/الأسباب) ناقصة", critical: true });
  return missing;
}

/** يحوّل النواقص والثقة إلى مستوى فهم. */
function deriveUnderstanding(confidence: number, missing: MissingInfoItem[]): UnderstandingLevel {
  const criticalMissing = missing.filter((m) => m.critical).length;
  if (criticalMissing >= 2) return "AMBIGUOUS";
  if (criticalMissing === 1) return "INCOMPLETE";
  if (confidence >= 0.9) return "CONFIRMED";
  if (confidence >= 0.7) return "LIKELY";
  return "NEEDS_QUESTION";
}

/** يحسب درجة الثقة في الفهم (0..1) من عدد العناصر المُكتشفة. */
function computeConfidence(flags: { role: boolean; track: boolean; output: boolean; stage: boolean; facts: boolean }): number {
  const weights = { role: 0.25, track: 0.2, output: 0.25, stage: 0.1, facts: 0.2 };
  let score = 0;
  if (flags.role) score += weights.role;
  if (flags.track) score += weights.track;
  if (flags.output) score += weights.output;
  if (flags.stage) score += weights.stage;
  if (flags.facts) score += weights.facts;
  return Math.round(score * 100) / 100;
}

/** المخاطرة: عالية للمخرجات النهائية، متوسطة للتحليلية، منخفضة للاستكشافية. */
function deriveRisk(output: RequestedOutput): OutputRisk {
  if (HIGH_RISK_OUTPUTS.includes(output)) return "HIGH";
  if (output === "UNKNOWN" || output === "LEGAL_ANALYSIS" || output === "CASE_STRENGTH") return "MEDIUM";
  return "MEDIUM";
}

/** الكشف الحتمي الكامل من رسالة المستخدم. */
export function detectIntentDeterministic(
  message: string,
  documentsCount = 0
): IntentResult {
  const normalized = normalizeArabic(message);

  const role = pickRule<UserLegalRole>(normalized, ROLE_RULES, "UNKNOWN");
  const track = pickRule<LegalTrack>(normalized, TRACK_RULES, "UNKNOWN");
  const output = pickRule<RequestedOutput>(normalized, OUTPUT_RULES, "UNKNOWN");
  const stage = pickRule<ProceduralStage>(normalized, STAGE_RULES, "UNKNOWN");

  const hasJudgment = hasAny(normalized, JUDGMENT_SIGNALS);
  const hasArbitrationClause = hasAny(normalized, ARBITRATION_CLAUSE_SIGNALS) ? true : null;
  const claimValue = extractClaimValue(message);

  // إذا صدر حكم ولم يُكتشف مخرج اعتراضي، رجّح مسار الاعتراض.
  let effectiveStage = stage.value;
  if (hasJudgment && effectiveStage === "UNKNOWN") effectiveStage = "JUDGMENT_ISSUED";

  const facts = message.trim();
  const claims = /اطالب|اطلب|املك حق|الطلب|طلباتي|ابغى الزام/.test(normalized) ? facts : null;
  const defenses = /ادفع|دفعي|اعترض|انكر|غير صحيح|لم اوقع/.test(normalized) ? facts : null;

  const factsOk = facts.length >= 25;
  const confidence = computeConfidence({
    role: role.matched,
    track: track.matched,
    output: output.matched,
    stage: stage.matched || hasJudgment,
    facts: factsOk,
  });

  const missingInfo = computeMissingInfo({
    role: role.value,
    track: track.value,
    output: output.value,
    stage: effectiveStage,
    hasJudgment,
    hasArbitrationClause,
    facts,
    claims,
    documentsCount,
  });

  const understanding = deriveUnderstanding(confidence, missingInfo);
  const disputeType = describeDispute(track.value, normalized);

  return {
    intentSummary: buildIntentSummary(role.value, disputeType, output.value, effectiveStage),
    userRole: role.value,
    track: track.value,
    disputeType,
    requestedOutput: output.value,
    proceduralStage: effectiveStage,
    hasJudgment,
    hasArbitrationClause,
    claimValue,
    understanding,
    confidence,
    missingInfo,
    risk: deriveRisk(output.value),
    facts,
    claims,
    defenses,
    source: "deterministic",
  };
}

function buildIntentSummary(
  role: UserLegalRole,
  disputeType: string,
  output: RequestedOutput,
  stage: ProceduralStage
): string {
  const parts: string[] = [];
  parts.push(`يبدو أنك ${role === "UNKNOWN" ? "طرف في" : "في موقع"} ${disputeType}`);
  if (output !== "UNKNOWN") parts.push("وتطلب مخرجاً قضائياً محدداً");
  if (stage !== "UNKNOWN") parts.push("ضمن مرحلة إجرائية معيّنة");
  return parts.join(" ") + ".";
}

// ── الإثراء الاختياري من مزوّد الذكاء (لا يُغيّر الحتمي إلا إذا كان أوضح) ──

const INTENT_SYSTEM_PROMPT = [
  "أنت محلّل نيّة قانونية في منصة حكيم. مهمتك فهم رسالة المستخدم (قد تكون عاميّة سعودية أو غير مرتّبة)،",
  "وتحويلها إلى عناصر مُصنّفة. لا تُنتج مذكرة ولا حكماً ولا رأياً — فقط صنّف.",
  "أعد JSON صالحاً فقط (بلا أي نص قبله أو بعده) بالمفاتيح:",
  '{ "userRole": one of [PLAINTIFF,DEFENDANT,PLAINTIFF_LAWYER,DEFENDANT_LAWYER,CONSULTANT,ARBITRATOR,JUDGE_TRAINEE,RESEARCHER,SETTLEMENT_SEEKER,PRE_LITIGATION,UNKNOWN],',
  '  "track": one of [CIVIL,COMMERCIAL,LABOR,CRIMINAL,ADMINISTRATIVE,PERSONAL_STATUS,ARBITRATION,EXECUTION,UNKNOWN],',
  '  "requestedOutput": one of [CLAIM_SHEET,ANSWER_MEMO,REPLY_MEMO,OPPONENT_DEFENSES,CASE_STRENGTH,HEARING_SIMULATION,PROCEDURAL_DECISION,DRAFT_JUDGMENT,OBJECTION,APPEAL_MEMO,CASSATION_MEMO,RECONSIDERATION_MEMO,ARBITRATION_ORDER,ARBITRATION_AWARD,ARBITRATION_CLAUSE_CHECK,EVIDENCE_PLAN,DOCUMENTS_PLAN,SETTLEMENT_PLAN,CRIMINAL_DEFENSE,CONTRACT_REVIEW,LEGAL_ANALYSIS,UNKNOWN],',
  '  "proceduralStage": one of [PRE_LITIGATION,FILING,FIRST_INSTANCE,EVIDENCE,PLEADING_CLOSED,JUDGMENT_ISSUED,APPEAL,CASSATION,RECONSIDERATION,EXECUTION,UNKNOWN],',
  '  "disputeType": "وصف موجز لنوع النزاع بالعربية",',
  '  "hasJudgment": boolean, "hasArbitrationClause": boolean|null,',
  '  "intentSummary": "جملة بلغة بشرية تصف ما فهمته" }',
].join("\n");

const VALID_ROLES: UserLegalRole[] = ["PLAINTIFF", "DEFENDANT", "PLAINTIFF_LAWYER", "DEFENDANT_LAWYER", "CONSULTANT", "ARBITRATOR", "JUDGE_TRAINEE", "RESEARCHER", "SETTLEMENT_SEEKER", "PRE_LITIGATION", "UNKNOWN"];
const VALID_TRACKS: LegalTrack[] = ["CIVIL", "COMMERCIAL", "LABOR", "CRIMINAL", "ADMINISTRATIVE", "PERSONAL_STATUS", "ARBITRATION", "EXECUTION", "UNKNOWN"];
const VALID_OUTPUTS: RequestedOutput[] = ["CLAIM_SHEET", "ANSWER_MEMO", "REPLY_MEMO", "OPPONENT_DEFENSES", "CASE_STRENGTH", "HEARING_SIMULATION", "PROCEDURAL_DECISION", "DRAFT_JUDGMENT", "OBJECTION", "APPEAL_MEMO", "CASSATION_MEMO", "RECONSIDERATION_MEMO", "ARBITRATION_ORDER", "ARBITRATION_AWARD", "ARBITRATION_CLAUSE_CHECK", "EVIDENCE_PLAN", "DOCUMENTS_PLAN", "SETTLEMENT_PLAN", "CRIMINAL_DEFENSE", "CONTRACT_REVIEW", "LEGAL_ANALYSIS", "UNKNOWN"];
const VALID_STAGES: ProceduralStage[] = ["PRE_LITIGATION", "FILING", "FIRST_INSTANCE", "EVIDENCE", "PLEADING_CLOSED", "JUDGMENT_ISSUED", "APPEAL", "CASSATION", "RECONSIDERATION", "EXECUTION", "UNKNOWN"];

function pickEnum<T>(v: unknown, valid: T[], fallback: T): T {
  return typeof v === "string" && (valid as unknown[]).includes(v) ? (v as T) : fallback;
}

/**
 * الفهم الكامل: حتمي + إثراء LLM اختياري.
 * يبقى الحتمي هو الأساس؛ يُستبدل عنصر فقط إذا كان الحتمي UNKNOWN وأعطى المزوّد قيمة صريحة.
 */
export async function detectIntent(message: string, documentsCount = 0): Promise<IntentResult> {
  const base = detectIntentDeterministic(message, documentsCount);

  // إثراء فقط عند وجود غموض (لتوفير النداءات ومنع التكلفة بلا حاجة).
  const needsEnrichment =
    base.userRole === "UNKNOWN" || base.track === "UNKNOWN" || base.requestedOutput === "UNKNOWN";
  if (!needsEnrichment) return base;

  try {
    const llm = await callCentralProvider({
      systemPrompt: INTENT_SYSTEM_PROMPT,
      userPrompt: `رسالة المستخدم:\n${message.trim()}`,
      maxTokens: 600,
    });
    if (!llm.ok || !llm.content.trim()) return base;
    const start = llm.content.indexOf("{");
    const end = llm.content.lastIndexOf("}");
    if (start === -1 || end <= start) return base;
    const obj = JSON.parse(llm.content.slice(start, end + 1)) as Record<string, unknown>;

    const role = base.userRole === "UNKNOWN" ? pickEnum(obj.userRole, VALID_ROLES, "UNKNOWN") : base.userRole;
    const track = base.track === "UNKNOWN" ? pickEnum(obj.track, VALID_TRACKS, "UNKNOWN") : base.track;
    const output = base.requestedOutput === "UNKNOWN" ? pickEnum(obj.requestedOutput, VALID_OUTPUTS, "UNKNOWN") : base.requestedOutput;
    const stage = base.proceduralStage === "UNKNOWN" ? pickEnum(obj.proceduralStage, VALID_STAGES, "UNKNOWN") : base.proceduralStage;
    const hasJudgment = base.hasJudgment || obj.hasJudgment === true;
    const hasArbitrationClause =
      base.hasArbitrationClause !== null
        ? base.hasArbitrationClause
        : typeof obj.hasArbitrationClause === "boolean"
          ? (obj.hasArbitrationClause as boolean)
          : null;
    const disputeType = base.track === "UNKNOWN" && typeof obj.disputeType === "string" && obj.disputeType.trim() ? obj.disputeType.trim() : base.disputeType;
    const intentSummary = typeof obj.intentSummary === "string" && obj.intentSummary.trim() ? obj.intentSummary.trim() : base.intentSummary;

    const missingInfo = computeMissingInfo({
      role,
      track,
      output,
      stage,
      hasJudgment,
      hasArbitrationClause,
      facts: base.facts,
      claims: base.claims,
      documentsCount,
    });
    const confidence = computeConfidence({
      role: role !== "UNKNOWN",
      track: track !== "UNKNOWN",
      output: output !== "UNKNOWN",
      stage: stage !== "UNKNOWN",
      facts: base.facts.length >= 25,
    });
    const understanding = deriveUnderstanding(confidence, missingInfo);

    return {
      ...base,
      userRole: role,
      track,
      requestedOutput: output,
      proceduralStage: stage,
      hasJudgment,
      hasArbitrationClause,
      disputeType,
      intentSummary,
      missingInfo,
      confidence,
      understanding,
      risk: deriveRisk(output),
      source: "hybrid",
    };
  } catch {
    return base;
  }
}

/**
 * يبني نيّة من ملف القضية المتراكم (لتشغيل التقرير عند طلب «اعرض التقرير»
 * بينما الرسالة الحالية مجرّد موافقة لا تحمل وقائع).
 */
export function intentFromCaseFile(cf: SimulationCaseFile): IntentResult {
  const factsText = cf.facts.map((f) => f.text).join(". ");
  const base = detectIntentDeterministic(
    [factsText, cf.claims ?? "", cf.disputeType].filter(Boolean).join(". ")
  );
  return {
    ...base,
    userRole: cf.userRole !== "UNKNOWN" ? cf.userRole : base.userRole,
    track: cf.track !== "UNKNOWN" ? cf.track : base.track,
    proceduralStage: cf.proceduralStage !== "UNKNOWN" ? cf.proceduralStage : base.proceduralStage,
    disputeType: cf.disputeType || base.disputeType,
    claims: cf.claims ?? base.claims,
    defenses: cf.defenses ?? base.defenses,
    hasArbitrationClause: cf.hasArbitrationClause,
    claimValue: cf.claimValue ?? base.claimValue,
    facts: factsText || base.facts,
  };
}

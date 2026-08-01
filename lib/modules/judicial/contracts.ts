// ─────────────────────────────────────────────────────────────────────────────
// HKM-JDS-002 — عقود طبقة الإجراءات والصياغة القضائية السعودية (JDS v2)
//
// هذه الطبقة **مشتركة**: تستوردها كلّ خدمات المنصّة (اسأل حكيم، القاضي التفاعلي،
// الوكيل القانوني، المساعد القضائي، الاستشارات…) فتنتفع بتصنيفٍ موحّد للدور والمرحلة
// ومستوى السلطة، وبإطار بوّابات الجودة واللغة القضائية — دون بناء «مكدّس ثالث».
//
// PR1 = العقود + السجلّات فقط (بلا هجرة قاعدة بيانات، بلا نداء نموذج). كلّ نوعٍ هنا
// يطابق ترقيم الأمر الحاكم (§) كي يبقى التتبّع بين الأمر والكود ممكنًا.
// ─────────────────────────────────────────────────────────────────────────────

// ── §6 — طبقات السلطة والمصدر ──────────────────────────────────────────────────
// تُصنّف كلّ مادّةٍ معرفيّة إلى طبقةٍ واضحة تحدّد حجّيتها في التوليد.
export type JudicialSourceLayer =
  | "CURRENT_OFFICIAL_AUTHORITY" // نصّ نظاميّ سعوديّ ساري (المصدر النهائيّ للحكم/الإجراء الحاليّ)
  | "OFFICIAL_JUDICIAL_PRINCIPLE" // مبدأ قضائيّ رسميّ
  | "CASE_FILE_EVIDENCE" // دليل من ملفّ القضية
  | "JUDICIAL_METHOD_REFERENCE" // مرجع منهج قضائيّ (يؤسّس التسلسل لا الحكم)
  | "JUDICIAL_STYLE_REFERENCE" // مرجع أسلوب/صياغة قضائيّة
  | "ACADEMIC_OR_FIQH_REFERENCE" // مرجع علميّ أو فقهيّ
  | "INTERNAL_HAKEEM_POLICY" // سياسة حكيم الداخليّة
  | "MODEL_INFERENCE"; // استنتاج النموذج (أضعف الطبقات — يلزمه سند)

/** الطبقات التي يجوز أن تكون مصدرًا نهائيًّا للحكم الموضوعيّ أو الإجراء الحاليّ (§6.1). */
export const AUTHORITATIVE_LAYERS: readonly JudicialSourceLayer[] = [
  "CURRENT_OFFICIAL_AUTHORITY",
  "OFFICIAL_JUDICIAL_PRINCIPLE",
] as const;

// ── §15 — التصنيف متعدّد المحاور ───────────────────────────────────────────────
export type JudicialRole = "JUDGE" | "JUDICIAL_ASSISTANT" | "LAWYER" | "PARTY" | "RESEARCHER";

export type CourtTrack =
  | "GENERAL"
  | "COMMERCIAL"
  | "LABOR"
  | "PERSONAL_STATUS"
  | "CRIMINAL"
  | "EXECUTION"
  | "ARBITRATION"
  | "ADMINISTRATIVE"
  | "OTHER";

export type LitigationStage =
  | "PRE_FILING"
  | "FILING"
  | "SERVICE"
  | "PLEADING"
  | "EVIDENCE"
  | "EXPERTISE"
  | "CLOSING_ARGUMENT"
  | "DELIBERATION"
  | "JUDGMENT"
  | "APPEAL"
  | "CASSATION"
  | "RECONSIDERATION"
  | "EXECUTION";

export type DocumentFunction =
  | "RECORD"
  | "CLAIM_FORMULATION"
  | "ANSWER_FORMULATION"
  | "DEFENSE"
  | "EVIDENCE_ANALYSIS"
  | "PROCEDURAL_REQUEST"
  | "PROCEDURAL_DECISION"
  | "ISSUE_MAP"
  | "REASONING"
  | "DISPOSITION"
  | "CONSISTENCY_REVIEW"
  | "OBJECTION";

export type EvidencePosture =
  | "NO_EVIDENCE"
  | "DOCUMENTARY"
  | "ADMISSION"
  | "DENIAL"
  | "TESTIMONY"
  | "OATH"
  | "EXPERT"
  | "DIGITAL"
  | "MIXED"
  | "CONFLICTED";

export type ProceduralPosture =
  | "JURISDICTION_PENDING"
  | "CAPACITY_PENDING"
  | "STANDING_PENDING"
  | "ADMISSIBILITY_PENDING"
  | "SERVICE_PENDING"
  | "MERITS_READY"
  | "INSUFFICIENT_FACTS"
  | "INSUFFICIENT_AUTHORITY"
  | "READY_FOR_DECISION";

export type JudicialRiskLevel = "MEDIUM" | "HIGH" | "RESTRICTED";

/** §15 — الوصف متعدّد المحاور لأيّ مهمّة قضائيّة قبل التوليد. */
export interface JudicialTaskCharacterization {
  role: JudicialRole;
  courtTrack: CourtTrack;
  litigationStage: LitigationStage;
  documentFunction: DocumentFunction;
  evidencePosture: EvidencePosture;
  proceduralPosture: ProceduralPosture;
  riskLevel: JudicialRiskLevel;
}

// ── §14 — الفصل الصارم بين الأدوار ─────────────────────────────────────────────
export type JudicialVoiceProfile =
  | "JUDICIAL_BENCH_RESTRICTED" // صوت المحكمة: محايد ومسبّب، مسودّة داخليّة غير ملزمة
  | "JUDICIAL_PARTY" // صوت الطرف/المحامي: دفوع وطلبات
  | "JUDICIAL_RESEARCH_AND_TRAINING"; // صوت الباحث: تحليل وتوثيق

// ── §13.4 — مستوى الجزم ────────────────────────────────────────────────────────
export type AssertionLevel =
  | "ASSERTED" // ادّعاء مجرّد
  | "SUPPORTED" // مدعوم بقرينة
  | "ESTABLISHED" // ثابت
  | "DISPUTED" // متنازع فيه
  | "INFERRED" // استنتاج معلن
  | "UNSUPPORTED"; // بلا سند

// ── §11 — نمط الجينوم القضائيّ ──────────────────────────────────────────────────
export type JudicialPatternClass =
  | "CASE_CLASSIFICATION"
  | "PROCEDURAL_SEQUENCE"
  | "CLAIM_FORMULATION"
  | "ANSWER_FORMULATION"
  | "JUDICIAL_VERB"
  | "CONDITIONAL_BRANCH"
  | "FACT_STATUS_EXPRESSION"
  | "EVIDENCE_EXPRESSION"
  | "OATH_EXPRESSION"
  | "EXPERT_EXPRESSION"
  | "REASONING_TRANSITION"
  | "DISPOSITION_EXPRESSION"
  | "RECORD_FORMALISM"
  | "ISSUE_PRESENTATION"
  | "BENEFIT_PRESENTATION"
  | "DISAGREEMENT_PRESENTATION"
  | "APPEAL_ROUTE_TERMINOLOGY"
  | "CURRENT_LAW_REQUIREMENT";

export type JudicialPatternStatus = "DRAFT" | "REVIEWED" | "ACTIVE" | "DEPRECATED";

export interface JudicialPatternVariable {
  name: string;
  type: string;
  required: boolean;
}

/** §11 — نمطٌ قضائيّ مستخرَج (لغة/إجراء) بمصدره وشروط جوازه ومنعه. */
export interface JudicialPattern {
  id: string;
  code: string;
  version: string;
  status: JudicialPatternStatus;
  patternClass: JudicialPatternClass;

  // مصدر النمط (يُحفظ لكلّ نمطٍ مُستخرَج — منع الاختلاق §4/§27)
  sourceLayer: JudicialSourceLayer;
  sourceFileId?: string;
  sourcePage?: number;
  sourceSection?: string;
  sourceTextShort?: string;

  normalizedPatternAr: string;
  semanticFunctionAr: string;

  appliesToRoles: JudicialRole[];
  appliesToDomains: CourtTrack[];
  appliesToStages: LitigationStage[];
  appliesToDocumentTypes: DocumentFunction[];
  appliesWhen: string[];
  prohibitedWhen: string[];

  requiredAuthorityTypes: JudicialSourceLayer[];
  currentLawCheckRequired: boolean;

  variables: JudicialPatternVariable[];
  positiveExamples: string[];
  negativeExamples: string[];

  approvedBy?: string;
  approvedAt?: string;
}

// ── §12 — خريطة الإجراءات القضائيّة ─────────────────────────────────────────────
export type ProcedureNodeType =
  | "PRECONDITION"
  | "FILING"
  | "SERVICE"
  | "HEARING"
  | "CLAIM"
  | "ANSWER"
  | "EVIDENCE"
  | "EXPERTISE"
  | "OATH"
  | "PROCEDURAL_DECISION"
  | "MERITS_DECISION"
  | "OBJECTION"
  | "EXECUTION";

export type ProcedureNodeStatus =
  | "NOT_STARTED"
  | "READY"
  | "COMPLETED"
  | "BLOCKED"
  | "NOT_APPLICABLE";

export interface JudicialProcedureNode {
  id: string;
  type: ProcedureNodeType;
  titleAr: string;
  status: ProcedureNodeStatus;
  requiredFacts: string[];
  requiredDocuments: string[];
  requiredAuthorities: string[];
  completionCriteria: string[];
}

export interface JudicialProcedureEdge {
  from: string;
  to: string;
  condition: string;
  authoritySnapshotIds: string[];
}

/** §12 — مسار إجرائيّ ديناميكيّ للقضية الحالية (لا تكرار كتابٍ تدريبيّ). */
export interface JudicialProcedureGraph {
  id: string;
  caseId: string;
  domainPack: string;
  litigationStage: LitigationStage;
  lawAsOfDate: string;
  nodes: JudicialProcedureNode[];
  edges: JudicialProcedureEdge[];
  unresolvedRequirements: string[];
  validationStatus: string;
}

// ── §16 — وصفة المستند القضائيّ الديناميكيّة ────────────────────────────────────
export interface JudicialRecipeSection {
  key: string;
  titleAr: string;
  judicialFunction: string; // وظيفة القسم القضائيّة
  inclusionReason: string; // سبب إدراجه
  requiredFacts: string[];
  requiredEvidence: string[];
  requiredAuthorities: string[];
  allowedPatternIds: string[]; // الصيغ المسموحة
  prohibitedPatternIds: string[]; // الصيغ المحظورة
  completionCriteria: string[];
  qualityGateIds: string[]; // بوّابات جودة القسم
}

export type RecipeValidationStatus = "DRAFT" | "VALIDATED" | "NEEDS_REVIEW" | "APPROVED";

/** §16 — وصفةٌ تُبنى ديناميكيًّا من الدور والمجال والمرحلة والوقائع والأدلّة والنصوص السارية. */
export interface JudicialDocumentRecipe {
  id: string;
  taskId: string;
  version: string;
  outputType: DocumentFunction;
  roleProfile: JudicialVoiceProfile;
  courtTrack: CourtTrack;
  litigationStage: LitigationStage;
  lawAsOfDate: string;
  procedureGraphId?: string;
  sourceStyleSignatures: string[];
  domainPackVersion: string;
  sections: JudicialRecipeSection[];
  mandatoryProceduralChecks: string[];
  appliedPatternIds: string[];
  appliedAuthoritySnapshotIds: string[];
  validationStatus: RecipeValidationStatus;
}

// ── §22 — التتبّع على مستوى العبارة ─────────────────────────────────────────────
export type StatementType =
  | "PARTY_ASSERTION"
  | "ADMITTED_FACT"
  | "DENIED_FACT"
  | "DOCUMENTED_FACT"
  | "AUTHORITY"
  | "QUOTE"
  | "INFERENCE"
  | "PROCEDURAL_RESULT"
  | "DISPOSITION";

export type StatementVerificationStatus = "VERIFIED" | "NEEDS_REVIEW" | "UNSUPPORTED";

/** §22 — كلّ عبارةٍ جوهريّة تردّ إلى واقعة/دليل/سند/نمط صياغة/مرحلة أو استنتاج معلن. */
export interface JudicialStatementTrace {
  id: string;
  draftVersionId: string;
  sectionId: string;
  startOffset: number;
  endOffset: number;
  statementType: StatementType;
  assertionLevel: AssertionLevel;
  factIds: string[];
  evidenceIds: string[];
  authoritySnapshotIds: string[];
  draftingPatternIds: string[];
  procedureNodeIds: string[];
  verificationStatus: StatementVerificationStatus;
}

// ── §27 — إطار بوّابات الجودة ────────────────────────────────────────────────────
export type QualityGateSeverity = "BLOCKING" | "WARNING";

export interface JudicialQualityGate {
  id: string; // JG0..JG21
  code: string;
  titleAr: string;
  descriptionAr: string;
  severity: QualityGateSeverity;
  appliesToFunctions: DocumentFunction[] | "ALL";
}

// NEEDS_REVIEW: البوّابة لا تُجتاز آليًّا (تتطلّب تحقّقًا خارجيًّا/بشريًّا) — ليست PASS ولا FAIL.
export type GateOutcome = "PASS" | "FAIL" | "NOT_APPLICABLE" | "NEEDS_REVIEW";

export interface QualityGateResult {
  gateId: string;
  outcome: GateOutcome;
  findings: string[];
}

// ── §8 — حزم المواءمة بحسب المسار القضائيّ ──────────────────────────────────────
export interface JudicialDomainPack {
  id: string;
  titleAr: string;
  courtTrack: CourtTrack;
  version: string;
  lawAsOfDate: string; // نسخة السريان (§8)
  stages: LitigationStage[];
  playbookCategories: string[]; // ربطٌ بفئات data/judicial-playbooks.json القائمة
  prohibitedTransferFrom: CourtTrack[]; // §8.1 — لا يُنقل إجراء/نتيجة من هذه المسارات دون مواءمة
  notesAr: string;
}

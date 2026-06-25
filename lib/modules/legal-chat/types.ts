// ─────────────────────────────────────────────────────────────────────────────
// أنواع منصة العمل القضائية الذكية (Legal AI Workspace) في حكيم.
// تُبنى فوق النواة القانونية (legal-core / legal-rag / case-analysis / legal-agent)
// دون تعديلها. المبدأ الحاكم: «فهم → تأكيد → استكمال → استرجاع → تحليل → صياغة → مراجعة».
// كل المخرجات تدريبية/تحليلية وليست حكماً قضائياً فعلياً.
// ─────────────────────────────────────────────────────────────────────────────

/** صفة المستخدم في القضية (مَن يتحدّث؟). */
export type UserLegalRole =
  | "PLAINTIFF" // مدّعٍ
  | "DEFENDANT" // مدّعى عليه
  | "PLAINTIFF_LAWYER" // محامي المدعي
  | "DEFENDANT_LAWYER" // محامي المدعى عليه
  | "CONSULTANT" // مستشار
  | "ARBITRATOR" // محكم
  | "JUDGE_TRAINEE" // قاضٍ افتراضي للتدريب
  | "RESEARCHER" // باحث
  | "SETTLEMENT_SEEKER" // طرف يريد صلحاً
  | "PRE_LITIGATION" // طرف يريد تحليل موقفه قبل التقاضي
  | "UNKNOWN"; // لم تتّضح بعد

/** المسار القضائي العام للنزاع. */
export type LegalTrack =
  | "CIVIL" // مدني (المعاملات المدنية + المرافعات الشرعية)
  | "COMMERCIAL" // تجاري (المحاكم التجارية)
  | "LABOR" // عمالي
  | "CRIMINAL" // جزائي (الإجراءات الجزائية)
  | "ADMINISTRATIVE" // إداري (ديوان المظالم)
  | "PERSONAL_STATUS" // أحوال شخصية
  | "ARBITRATION" // تحكيم
  | "EXECUTION" // تنفيذ
  | "UNKNOWN";

/** المرحلة الإجرائية للقضية. */
export type ProceduralStage =
  | "PRE_LITIGATION" // قبل رفع الدعوى
  | "FILING" // قيد الدعوى
  | "FIRST_INSTANCE" // ابتدائي / تحت النظر
  | "EVIDENCE" // مرحلة الإثبات
  | "PLEADING_CLOSED" // بعد قفل باب المرافعة
  | "JUDGMENT_ISSUED" // صدر الحكم
  | "APPEAL" // استئناف
  | "CASSATION" // نقض / تمييز
  | "RECONSIDERATION" // التماس إعادة نظر
  | "EXECUTION" // تنفيذ
  | "UNKNOWN";

/** نوع المخرج المطلوب من حكيم. */
export type RequestedOutput =
  | "CLAIM_SHEET" // صحيفة دعوى
  | "ANSWER_MEMO" // مذكرة جوابية
  | "REPLY_MEMO" // مذكرة رد
  | "OPPONENT_DEFENSES" // توقّع دفوع الخصم
  | "CASE_STRENGTH" // تقييم قوة القضية
  | "HEARING_SIMULATION" // محاكاة جلسة
  | "PROCEDURAL_DECISION" // قرار إجرائي
  | "DRAFT_JUDGMENT" // مسودة حكم افتراضي
  | "OBJECTION" // اعتراض على حكم
  | "APPEAL_MEMO" // لائحة استئنافية
  | "CASSATION_MEMO" // طلب نقض/تمييز
  | "RECONSIDERATION_MEMO" // التماس إعادة نظر
  | "ARBITRATION_ORDER" // أمر إجرائي تحكيمي
  | "ARBITRATION_AWARD" // حكم تحكيم
  | "ARBITRATION_CLAUSE_CHECK" // فحص شرط تحكيم
  | "EVIDENCE_PLAN" // خطة إثبات
  | "DOCUMENTS_PLAN" // خطة مستندات
  | "SETTLEMENT_PLAN" // خطة صلح
  | "CRIMINAL_DEFENSE" // مذكرة دفاع جزائية
  | "CONTRACT_REVIEW" // مراجعة عقد
  | "LEGAL_ANALYSIS" // تحليل قانوني عام
  | "UNKNOWN";

/** مستوى ثقة حكيم في فهمه لطلب المستخدم. */
export type UnderstandingLevel =
  | "CONFIRMED" // فهم مؤكد
  | "LIKELY" // فهم راجح
  | "INCOMPLETE" // فهم ناقص
  | "AMBIGUOUS" // طلب ملتبس
  | "NEEDS_QUESTION"; // يحتاج سؤالاً موجهاً

/** مستوى مخاطرة المخرج (يحكم متى يلزم بطاقة فهم/موافقة قبل الإنتاج). */
export type OutputRisk = "LOW" | "MEDIUM" | "HIGH";

/** أنماط تشغيل الشات القضائي (تغيّر طريقة التفكير والأسئلة والمخرجات). */
export type SimulationMode =
  | "RESEARCHER" // الباحث القانوني
  | "PLAINTIFF_LAWYER" // محامي المدعي
  | "DEFENDANT_LAWYER" // محامي المدعى عليه
  | "OPPONENT" // الخصم الافتراضي
  | "JUDGE" // القاضي الافتراضي
  | "ARBITRATOR" // المحكم
  | "DRAFTING_REVIEWER" // مراجع الصياغة
  | "EVIDENCE_EXAMINER" // فاحص الإثبات
  | "JUDGMENT_EXAMINER" // فاحص الحكم
  | "CONTRACT_EXAMINER"; // فاحص العقد

/** قوة البحث في النواة القانونية. */
export type SearchStrength =
  | "QUICK" // بحث سريع — مواد أساسية
  | "BALANCED" // بحث متوازن — مواد ولوائح
  | "DEEP" // بحث عميق — مواد ولوائح ومصطلحات
  | "JUDICIAL_EXTENDED" // بحث قضائي موسّع — مواد وأحكام واتجاهات
  | "ARBITRATION"; // بحث تحكيمي

/** مصدر كل معلومة في ملف القضية (لمنع خلط المصادر — Case Memory). */
export type InfoProvenance =
  | "USER_MESSAGE" // من رسالة المستخدم
  | "UPLOADED_FILE" // من ملف مرفوع
  | "LEGAL_CORE" // من النواة القانونية
  | "SYSTEM_ASSUMPTION" // افتراض من النظام
  | "NEEDS_CONFIRMATION"; // يحتاج تأكيداً

/** عنصر ناقص مؤثّر يمنع الإنتاج النهائي عالي المخاطر. */
export interface MissingInfoItem {
  key: string;
  label: string; // ما الناقص؟ (عربي)
  critical: boolean; // مؤثّر يمنع المخرج النهائي؟
}

/** نتيجة محرك فهم النيّة (UserIntentEngine). */
export interface IntentResult {
  intentSummary: string; // ما الذي فهمه حكيم من رسالة المستخدم (لغة بشرية)
  userRole: UserLegalRole;
  track: LegalTrack;
  disputeType: string; // وصف نوع النزاع (نص حر مُستخرج)
  requestedOutput: RequestedOutput;
  proceduralStage: ProceduralStage;
  hasJudgment: boolean; // هل صدر حكم؟ (يحوّل المنطق إلى مسار اعتراض)
  hasArbitrationClause: boolean | null; // هل يوجد شرط تحكيم؟ (null = غير معلوم)
  claimValue: string | null; // قيمة المطالبة إن ذُكرت
  understanding: UnderstandingLevel;
  confidence: number; // 0..1 درجة وضوح الطلب
  missingInfo: MissingInfoItem[];
  risk: OutputRisk;
  facts: string; // الوقائع المُستخلَصة من الرسالة
  claims: string | null; // الطلبات إن وُجدت
  defenses: string | null; // الدفوع إن وُجدت
  source: "deterministic" | "llm" | "hybrid";
}

/** طرف في القضية. */
export interface CaseParty {
  name: string;
  role: string; // مدّعٍ | مدّعى عليه | وكيل ...
  capacity?: string; // الصفة (أصالة/وكالة/ولاية)
  provenance: InfoProvenance;
}

/** واقعة في ملف القضية مع مصدرها. */
export interface CaseFact {
  text: string;
  provenance: InfoProvenance;
  disputed?: boolean;
  materiality?: "MATERIAL" | "IMMATERIAL" | "UNKNOWN";
}

/** عنصر بيّنة في ملف القضية. */
export interface CaseEvidenceItem {
  title: string;
  type: string; // عقد | فاتورة | مراسلة | محرر رسمي | دليل رقمي ...
  description?: string;
  strength?: "STRONG" | "MEDIUM" | "WEAK" | "UNKNOWN";
  admissibility?: "ADMISSIBLE" | "QUESTIONABLE" | "INADMISSIBLE" | "UNKNOWN";
  provenance: InfoProvenance;
}

/** ملف القضية الحيّ (Case Memory) — قابل للتحديث ومرتبط بالمحادثة فقط. */
export interface SimulationCaseFile {
  title: string;
  userRole: UserLegalRole;
  track: LegalTrack;
  disputeType: string;
  proceduralStage: ProceduralStage;
  status: "DRAFT" | "INCOMPLETE" | "READY";
  summary: string;
  claimValue: string | null;
  hasArbitrationClause: boolean | null;
  parties: CaseParty[];
  facts: CaseFact[];
  claims: string | null;
  defenses: string | null;
  evidence: CaseEvidenceItem[];
  missingInfo: MissingInfoItem[];
}

/** بطاقة تأكيد الفهم (تُعرض قبل أي إنتاج عالي المخاطر). */
export interface UnderstandingCard {
  userRoleLabel: string;
  disputeTypeLabel: string;
  trackLabel: string;
  stageLabel: string;
  requestedOutputLabel: string;
  documentsNote: string;
  missingInfo: MissingInfoItem[];
  proposedPath: string[]; // المسار المقترح (خطوات)
  understanding: UnderstandingLevel;
  understandingLabel: string;
  confidence: number;
  question: string; // سؤال التأكيد
  options: UnderstandingOption[];
  canProduceNow: boolean; // هل يُسمح بالإنتاج النهائي الآن؟
  blockReason: string | null; // سبب المنع إن وُجد
}

export interface UnderstandingOption {
  key:
    | "CONFIRM"
    | "EDIT_ROLE"
    | "EDIT_OUTPUT"
    | "ADD_INFO"
    | "ASK_QUESTIONS"
    | "DRAFT_WITH_ASSUMPTIONS";
  label: string;
}

/** صفّ في خطة الإثبات (EvidenceLogicEngine). */
export interface EvidencePlanRow {
  fact: string; // الواقعة المراد إثباتها
  burdenOn: string; // المكلّف بالإثبات
  currentEvidence: string; // الدليل الحالي
  strength: string; // قوة الدليل
  gap: string; // النقص
  suggestedAction: string; // الإجراء المقترح
  impact: string; // الأثر في النتيجة
}

/** عنصر في خريطة الحجج (ArgumentMap). */
export interface ArgumentMapRow {
  issue: string;
  userArgument: string;
  userEvidence: string;
  opponentArgument: string;
  response: string;
  assessment: string;
}

/** حدث في الخط الزمني للقضية (CaseTimeline). */
export interface TimelineEvent {
  date: string;
  event: string;
  source: string;
  legalEffect: string;
}

/** عنصر في قائمة مسائل النزاع (IssuesList). */
export interface LegalIssue {
  issue: string;
  relatedFacts: string;
  evidence: string;
  basisNote: string;
  probableOutcome: string;
}

/** عنصر درجة الثقة القانونية (LegalConfidenceScore). */
export interface ConfidenceFactor {
  element: string;
  score: number; // 0..100
  note: string;
}

export interface LegalConfidenceScore {
  factors: ConfidenceFactor[];
  overall: number; // 0..100
  verdict: string; // وصف موجز لمستوى الجاهزية
}

/** استشهاد مُتحقَّق من النواة (مرتبط بـ Citation في النواة القانونية). */
export interface GroundedSource {
  type: "article" | "ruling" | "principle";
  systemName: string;
  reference: string; // المرجع الرسمي
  reason: string; // وجه الصلة بالمسألة
  explicit: boolean; // نص صريح أم مستنتج؟
  relevance: "HIGH" | "MEDIUM" | "LOW";
}

/** نوع البطاقة المُخرجة في الشات. */
export type ChatCardType =
  | "UNDERSTANDING" // بطاقة تأكيد الفهم
  | "CASE_FILE" // بطاقة ملف القضية
  | "OUTPUT" // بطاقة مخرج (مذكرة/حكم/تحليل)
  | "EVIDENCE_PLAN" // جدول خطة الإثبات
  | "ARGUMENT_MAP" // خريطة الحجج
  | "TIMELINE" // الخط الزمني
  | "ISSUES" // قائمة المسائل
  | "CONFIDENCE" // درجة الثقة القانونية
  | "OPPONENT" // الخصم الافتراضي (جدول الدفوع المتوقعة)
  | "JUDGE_VIEW" // القاضي الافتراضي (تحرير محل النزاع + أسئلة + منطوق محتمل)
  | "ARBITRATION_VIEW" // المحكّم (اتفاق/اختصاص/إجراءات/أمر/حكم)
  | "CONTRACT_REVIEW" // مراجعة عقد (جدول بنود/مخاطر/توصيات)
  | "DOC_ANALYSIS" // تحليل المستندات (متعدد المستندات + تعارض)
  | "COMPARE_STRATEGIES" // مقارنة الاستراتيجيات
  | "EXPLAIN" // اشرح لماذا وصلت لهذه النتيجة
  | "WORKFLOW" // مسار عمل قانوني (workflow/playbook)
  | "GOVERNANCE"; // تنبيه حوكمي

/** حالة المراجعة البشرية للمخرج (Human-in-the-Loop). */
export type ReviewState =
  | "AUTO_DRAFT" // مسودة آلية
  | "NEEDS_REVIEW" // يحتاج مراجعة
  | "REVIEWED" // تمت مراجعته
  | "APPROVED" // معتمد
  | "REJECTED" // مرفوض
  | "NEEDS_INFO"; // يحتاج معلومات إضافية

/** مخرج قضائي كامل (مذكرة/حكم/تحليل) مع حوكمته. */
export interface LegalOutput {
  outputType: RequestedOutput;
  title: string;
  sections: OutputSection[];
  sources: GroundedSource[];
  assumptions: string[]; // الافتراضات (تظهر صراحةً عند نقص البيانات)
  gaps: string[]; // النواقص المؤثّرة
  nextBestActions: string[]; // الخطوة التالية الأفضل
  reviewState: ReviewState;
  governanceNotes: string[];
  isDraftWithAssumptions: boolean;
}

export interface OutputSection {
  heading: string;
  body: string; // قد تكون فقرات بصياغة قضائية
}

// ── خصائص متقدمة: محاكاة الأدوار وتحليل المستندات والاستراتيجيات ──

/** صفّ في جدول الخصم الافتراضي. */
export interface OpponentRow {
  expectedDefense: string; // الدفع المتوقع
  strength: "STRONG" | "MEDIUM" | "WEAK";
  reason: string; // سبب القوة/الضعف
  suggestedResponse: string; // الرد المقترح
  requiredDocument: string; // المستند المطلوب للرد
}

/** رؤية القاضي الافتراضي (تدريبية). */
export interface JudgeView {
  disputeSubject: string; // تحرير محل النزاع
  materialFacts: string[]; // الوقائع المنتِجة
  burdenOfProof: string; // عبء الإثبات
  judgeQuestions: string[]; // أسئلة القاضي في الجلسة
  readyForJudgment: boolean; // هل القضية صالحة للحكم؟
  readinessReason: string;
  gapsBeforeClosing: string[]; // النواقص قبل قفل باب المرافعة
  draftReasoning: string[]; // أسباب افتراضية
  draftRuling: string; // منطوق افتراضي (غير ملزم)
  disclaimer: string;
}

/** رؤية المحكّم. */
export interface ArbitrationView {
  agreementCheck: string; // اتفاق التحكيم وصحته
  scope: string; // نطاق شرط التحكيم
  tribunalFormation: string; // تشكيل الهيئة
  jurisdiction: string; // الاختصاص
  applicableLaw: string; // النظام/القانون الواجب التطبيق
  procedure: string[]; // الإجراءات
  proceduralOrder: string[]; // أمر إجرائي / جدول مواعيد
  issues: string[]; // المسائل محل الفصل
  draftAwardNote: string; // ملاحظة على مسودة حكم التحكيم
  disclaimer: string;
}

/** صفّ في جدول مراجعة العقد. */
export interface ContractReviewRow {
  clause: string; // البند
  text: string; // النص (مقتطف)
  risk: string; // الخطر
  impact: string; // الأثر في النزاع المحتمل
  recommendation: string; // التوصية
}

/** نتيجة مراجعة العقد. */
export interface ContractReview {
  hasContent: boolean; // هل توفّر نص العقد للتحليل؟
  summary: string;
  parties: string[];
  obligations: string[];
  term: string | null;
  consideration: string | null;
  penaltyClause: string | null;
  arbitrationClause: string | null;
  jurisdiction: string | null;
  termination: string | null;
  rows: ContractReviewRow[];
  risks: string[];
}

/** تحليل مستند واحد. */
export interface DocAnalysisItem {
  name: string;
  kind: string; // النوع الذي حدّده المستخدم
  parties: string[];
  dates: string[];
  amounts: string[];
  references: string[]; // إشارات نظامية مذكورة
  summary: string;
}

/** تحليل متعدد المستندات (Multi-Document Reasoning). */
export interface DocAnalysis {
  hasContent: boolean;
  items: DocAnalysisItem[];
  conflicts: string[]; // تعارضات بين المستندات
  missing: string[]; // نواقص
}

/** صفّ في مقارنة الاستراتيجيات. */
export interface StrategyRow {
  strategy: string;
  advantages: string;
  risks: string;
  requirements: string;
  assessment: string;
}

/** بطاقة «اشرح لماذا وصلت لهذه النتيجة». */
export interface ExplainView {
  facts: string[];
  sources: string[];
  assumptions: string[];
  reasons: string[];
  confidence: number;
  whatWouldChange: string[];
}

/** خطوة في مسار عمل قانوني. */
export interface WorkflowStep {
  title: string;
  done: boolean;
  detail: string;
}

/** حالة تشغيل مسار عمل/Playbook. */
export interface WorkflowRunView {
  name: string;
  purpose: string;
  steps: WorkflowStep[];
  checklist: { item: string; ok: boolean }[];
  missingInputs: string[];
  nextStep: string;
  reviewRequired: boolean;
}

/** بطاقة واحدة في ردّ الشات. */
export interface ChatCard {
  type: ChatCardType;
  understanding?: UnderstandingCard;
  caseFile?: SimulationCaseFile;
  output?: LegalOutput;
  evidencePlan?: EvidencePlanRow[];
  argumentMap?: ArgumentMapRow[];
  timeline?: TimelineEvent[];
  issues?: LegalIssue[];
  confidence?: LegalConfidenceScore;
  opponent?: OpponentRow[];
  judge?: JudgeView;
  arbitration?: ArbitrationView;
  contractReview?: ContractReview;
  docAnalysis?: DocAnalysis;
  strategies?: StrategyRow[];
  explain?: ExplainView;
  workflow?: WorkflowRunView;
  governance?: string[];
}

/** مدخل دورة شات واحدة. */
export interface ChatTurnInput {
  message: string;
  mode: SimulationMode;
  searchStrength: SearchStrength;
  caseFile?: SimulationCaseFile | null; // ملف القضية القائم (إن وُجد)
  approval?:
    | "CONFIRM"
    | "DRAFT_WITH_ASSUMPTIONS"
    | null; // قرار المستخدم على بطاقة الفهم السابقة
  attachments?: ChatAttachmentMeta[];
  /** إخفاء البيانات الحساسة في المخرجات (Redaction). */
  redact?: boolean;
  /** تشغيل مسار عمل/Playbook محدّد بالاسم. */
  workflow?: string;
}

export interface ChatAttachmentMeta {
  fileName: string;
  mimeType: string;
  /** التصنيف الذي اختاره المستخدم للملف (لا يُحلَّل قبل سؤاله). */
  declaredKind?: string;
  /** النص المُستخرَج من الملف (للملفات النصية) — يُحلَّل فقط بعد تحديد النوع. */
  content?: string;
}

/** مخرج دورة شات واحدة. */
export interface ChatTurnResult {
  reply: string; // نص ردّ حكيم (لغة محادثة، لا قضائية)
  cards: ChatCard[];
  intent: IntentResult;
  caseFile: SimulationCaseFile;
  awaitingConfirmation: boolean; // هل ينتظر حكيم موافقة على بطاقة الفهم؟
  trainingDisclaimer: string;
  provider: string;
  model: string;
  generated: boolean;
}

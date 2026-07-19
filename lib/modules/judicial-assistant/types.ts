// ─────────────────────────────────────────────────────────────────────────────
// المعاون القضائي السعودي — نماذج النطاق (Domain Types)
// خدمة مستقلّة داخل حكيم، منفصلة عن «اسأل حكيم» وأوضاعه الستّة. مساحةُ قضيةٍ ذكيّة
// تقود العمل بحسب المرحلة، لا دردشة. المرجع: المواصفة الوظيفية النهائية v2.0 (§14–§34).
// كلّ عنصرٍ مستخرَج يحمل مصدرًا وحالة تحقّق؛ الحقائق تميّز الادعاء عن الثابت (§32).
// ─────────────────────────────────────────────────────────────────────────────

/** نوع القضاء — يحكم اختيار النظام الإجرائيّ ولا يُخلط (§6). */
export type Jurisdiction = "general" | "commercial" | "criminal" | "administrative" | "labor";

/** درجة السرّية على القضية (ABAC، §12). */
export type Confidentiality = "normal" | "restricted" | "secret";

/** مراحل القضية الذكيّة (§14) — تشرح الحالة ولا توحي بنتيجةٍ للقضية (§21). */
export type CaseStage =
  | "imported"
  | "ingestion"
  | "parsed"
  | "mapped"
  | "review_required"
  | "active"
  | "hearing_preparation"
  | "deliberation"
  | "drafting"
  | "quality_review"
  | "appeal_review"
  | "closed";

/** حالة الحقيقة (§32، §33): تفصل الحقيقة عن الادعاء والاستنتاج. */
export type FactStatus = "alleged" | "admitted" | "denied" | "established" | "unresolved";

/** حالة تحقّق أيّ عنصرٍ مستخرَج آليًّا. */
export type VerificationStatus = "machine" | "human_verified" | "disputed";

/** هرم المصادر (§8): A ملزم … E مساند. */
export type SourceGrade = "A" | "B" | "C" | "D" | "E";

/** حالة المدّة الزمنيّة — تُلوّن في الواجهة (§20، شاشة المدد). */
export type DeadlineStatus = "upcoming" | "due_soon" | "overdue" | "met";

/** طرفٌ في القضية. */
export interface Party {
  id: string;
  name: string;
  role: string; // مدّعٍ | مدّعى عليه | وكيل … (نصّ عربيّ)
  representative?: string;
}

/** طلبٌ من طلبات الدعوى. */
export interface CaseRequest {
  id: string;
  text: string;
  byPartyId: string;
  status: "pending" | "granted_sought" | "contested";
}

/** واقعةٌ في القضية — مع حالتها ومصدرها. */
export interface CaseFact {
  id: string;
  text: string;
  status: FactStatus;
  verification: VerificationStatus;
  sourceLabel: string; // مرجع المستند/الصفحة (بيانات صناعيّة في هذه المرحلة)
  hasEvidence: boolean;
}

/** جلسة. */
export interface Hearing {
  id: string;
  date: string; // ISO ثابت (بيانات صناعيّة)
  purpose: string;
  hasMinutes: boolean;
}

/** مدّةٌ إجرائيّة (§20، شاشة المدد). */
export interface Deadline {
  id: string;
  label: string;
  dueDate: string; // ISO ثابت
  status: DeadlineStatus;
  basis: string; // القاعدة الإجرائيّة المستند إليها (نصّ)
}

/** مسألةٌ محلّ الفصل (§20، المسائل القضائيّة). */
export interface CaseIssue {
  id: string;
  statement: string;
  resolved: boolean;
}

/** مستندٌ في ملفّ القضية. */
export interface CaseDocument {
  id: string;
  title: string;
  kind: string; // لائحة دعوى | مذكرة | محضر | مرفق …
  quality: "good" | "low" | "corrupt";
  pages: number;
}

/** فجوةٌ/نقصٌ يُظهر بوضوح ولا يُخفى (§23 Partial). */
export interface CaseGap {
  id: string;
  text: string;
  severity: "info" | "warning" | "critical";
}

/** مرفقٌ رفعه المستخدم — المدخل الأساسيّ (لا موصل رسميّ). النصّ مُستخرَجٌ في المتصفّح (PDPL). */
export interface CaseAttachment {
  id: string;
  name: string;
  text: string; // النصّ المُستخرَج من الوثيقة (المادّة التي تُحلَّل)
  chars: number;
  addedAt: string; // ISO
}

/**
 * رأس القضية (§21) + خريطتها. القضية **مشروع/مجلّد يملكه القاضي** ويبنيه من مرفقاته —
 * لا موصل «تقاضي». الخريطة (أطراف/وقائع/…) تبدأ فارغة وتُثرى لاحقًا؛ المرفقات هي مادّة التحليل.
 */
export interface JudicialCase {
  id: string;
  ownerId: string; // مالك القضية (القاضي) — أساس ABAC
  caseNumber?: string; // رقمٌ اختياريّ يُدخله المستخدم
  court?: string;
  circuit?: string;
  jurisdiction: Jurisdiction;
  subject: string; // عنوان/موضوع القضية (يُدخله المستخدم)
  stage: CaseStage;
  confidentiality: Confidentiality;
  createdAt: string; // ISO
  attachments: CaseAttachment[];
  parties: Party[];
  requests: CaseRequest[];
  facts: CaseFact[];
  hearings: Hearing[];
  deadlines: Deadline[];
  issues: CaseIssue[];
  gaps: CaseGap[];
}

/** بطاقةٌ مختصرة للقضية في القوائم. */
export interface CaseSummaryRow {
  id: string;
  caseNumber?: string;
  court?: string;
  jurisdiction: Jurisdiction;
  subject: string;
  stage: CaseStage;
  confidentiality: Confidentiality;
  nextHearing?: string;
  openIssues: number;
  attachmentCount: number;
}

/** تعريف خدمةٍ من كتالوج الأعمال (§16): JS-001 … JS-024. */
export interface ServiceDef {
  id: string; // JS-001 …
  title: string;
  review: "optional" | "required" | "mandatory";
  iconKey: string; // مفتاح في خريطة الأيقونات (§24)
  /** هل هذه الخدمة منفّذة فعلًا في هذه المرحلة (وإلا فهي على خارطة الطريق)؟ */
  available: boolean;
}

/** عملٌ مقترحٌ سياقيًّا بحسب المرحلة (§15) — يُقترح ولا يُنفَّذ تلقائيًّا. */
export interface SuggestedAction {
  serviceId: string;
  title: string;
  reason: string; // لماذا اقتُرح الآن (شفافيّة المسار)
  iconKey: string;
  available: boolean;
}

/** JS-009 — حساب مدّةٍ إجرائيّة بمحرّكٍ حتميّ يشرح الحساب (§47، §48). */
export interface DeadlineComputation {
  ruleId: string;
  label: string;
  anchorLabel: string; // الحدث المرجعيّ (جلسة/حكم/إيداع…)
  anchorDate: string; // ISO
  offsetDays: number;
  direction: "before" | "after";
  dueDate: string; // ISO المحسوب
  explanation: string; // شرح الحساب خطوةً بخطوة
  basisNote: string; // الأساس (نموذجيّ غير معتمد في هذه المرحلة)
  approved: boolean;
}

export interface DeadlineResult {
  serviceId: "JS-009";
  deterministic: true;
  computations: DeadlineComputation[];
  disclaimer: string;
}

/** JS-010 — صفٌّ في مصفوفة الإثبات (نتيجة أوليّة لا تقرّر ثبوتًا نهائيًّا، §18.5). */
export interface EvidenceMatrixRow {
  factId: string;
  fact: string;
  status: FactStatus;
  burdenParty: string; // من يقع عليه عبء الإثبات (اشتقاقٌ من حالة الواقعة)
  hasEvidence: boolean;
  tentative: "محسومة" | "قابلة للإثبات" | "تحتاج دليلًا" | "محلّ نزاع";
  note: string;
}

export interface EvidenceMatrixResult {
  serviceId: "JS-010";
  deterministic: true;
  rows: EvidenceMatrixRow[];
  gaps: string[]; // وقائع بلا دليلٍ مرتبط
  disclaimer: string;
}

/** JS-004 — حدثٌ في الخطّ الزمنيّ الإجرائيّ. */
export interface TimelineEvent {
  date: string; // ISO
  kind: "hearing" | "deadline";
  label: string;
  detail: string;
  flag?: string; // ملاحظة اتساقٍ زمنيّ (تعارض/تأخّر) إن وُجدت
}

export interface TimelineResult {
  serviceId: "JS-004";
  deterministic: true;
  events: TimelineEvent[];
  conflicts: string[];
  disclaimer: string;
}

/** بندٌ في قائمة فحصٍ إجرائيّة (JS-006/JS-007) — سؤال مراجعةٍ لا حكم. */
export interface ChecklistItem {
  key: string;
  question: string;
  outcome: "review" | "missing" | "flag"; // مراجعة | بيانات ناقصة | تنبيه
  note: string;
}

export interface ChecklistResult {
  serviceId: "JS-006" | "JS-007";
  deterministic: true;
  title: string;
  items: ChecklistItem[];
  missing: string[]; // بيانات ناقصة تمنع الجزم
  disclaimer: string;
}

export type DeterministicActionResult = DeadlineResult | EvidenceMatrixResult | TimelineResult | ChecklistResult;

/** قسمٌ في مسودّة الحكم (§51). */
export interface JudgmentSection {
  key: string;
  title: string;
  body: string;
  /** هل هذا القسم مُولَّد بالنموذج (يحتاج تدقيقًا) أم مبنيّ حتميًّا من بيانات القضية؟ */
  generated: boolean;
}

/** JS-018 مشروع الحكم — هيكلٌ حتميّ + تسبيبٌ مؤصَّل + سوابق من النواة. مسودّةٌ تحتاج تثبيتًا. */
export interface JudgmentDraftResult {
  serviceId: "JS-018";
  blocked: boolean;
  sections: JudgmentSection[];
  citations: Array<{ articleId: string; lawName: string; articleNumber: number; quote: string }>;
  precedents: Array<{ id: string; title: string; court?: string; decisionNo?: string; snippet: string; reviewed: boolean }>;
  requestId: string;
  notice: string;
}

/** JS-013 الدراسة القضائيّة المعمّقة — تحليلٌ مؤصَّلٌ للمسائل + بدائل + سوابق من النواة. */
export type StudyDepth = "short" | "medium" | "extended";
export interface JudicialStudyResult {
  serviceId: "JS-013";
  blocked: boolean;
  depth: StudyDepth;
  body: string; // الدراسة المؤصَّلة (أو رسالة الحجب الصادق)
  citations: Array<{ articleId: string; lawName: string; articleNumber: number; quote: string }>;
  precedents: Array<{ id: string; title: string; court?: string; decisionNo?: string; snippet: string; reviewed: boolean }>;
  issues: string[]; // المسائل التي تناولتها الدراسة
  requestId: string;
  notice: string;
}

/** مخرَج JS-001 (الملخّص التنفيذيّ) — مؤصَّلٌ باستشهاداتٍ حقيقيّة أو حجبٌ صادق. */
export interface ExecutiveSummaryResult {
  requestId: string;
  blocked: boolean;
  summary: string;
  citations: Array<{ articleId: string; lawName: string; articleNumber: number; quote: string }>;
  humanReviewRequired: boolean;
  generatedAtLabel: string;
  notice: string;
}

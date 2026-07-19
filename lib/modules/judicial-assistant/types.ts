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

/** رأس القضية (§21) + خريطتها. نموذجٌ صناعيّ في هذه المرحلة (Mock Connector). */
export interface JudicialCase {
  id: string;
  externalRef: string; // مرجع النظام الرسميّ (صناعيّ)
  caseNumber: string;
  court: string;
  circuit: string;
  jurisdiction: Jurisdiction;
  subject: string;
  stage: CaseStage;
  confidentiality: Confidentiality;
  lastSync: string; // ISO ثابت
  synthetic: true; // وسمٌ صريح: بيانات صناعيّة، لا قضيةٌ حقيقيّة (§محظورات)
  parties: Party[];
  requests: CaseRequest[];
  facts: CaseFact[];
  hearings: Hearing[];
  deadlines: Deadline[];
  issues: CaseIssue[];
  documents: CaseDocument[];
  gaps: CaseGap[];
}

/** بطاقةٌ مختصرة للقضية في القوائم. */
export interface CaseSummaryRow {
  id: string;
  caseNumber: string;
  court: string;
  jurisdiction: Jurisdiction;
  subject: string;
  stage: CaseStage;
  confidentiality: Confidentiality;
  nextHearing?: string;
  openIssues: number;
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

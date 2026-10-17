// أنواع مكتب التحرير التشريعي وأخطاؤه. بلا اعتماد على Next أو Prisma (تُستورد في الاختبارات).

export type EditorialStatus =
  | "draft"
  | "checks_failed"
  | "pending"
  | "approved"
  | "rejected"
  | "published"
  | "reverted";

export type ActorKind = "human" | "agent";

/** أنواع العناصر التي تُكلَّف بها الأدوار وتُضبط لها السياسات (ق-٤). */
export const ITEM_KINDS = ["set_work_status", "review_amendment_op", "review_principle", "revert"] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];

/**
 * صلاحيات المستخدم في المكتب محلولةً من تكليفه في إعدادات المكتب (ق-٢) ونطاقه (ق-٥).
 * المالك (SUPER_ADMIN) يملك كل شيء ضمنًا ولا يكون وكيلًا.
 */
export interface EditorialAccess {
  superAdmin: boolean;
  /** حساب وكيل آلي (تكليف بنوع agent): يقترح فقط، ولا يعتمد ولا ينشر مهما كُلّف. */
  agent: boolean;
  editorLaws: boolean;
  editorRulings: boolean;
  reviewer: boolean;
  publisher: boolean;
  qaView: boolean;
  itemKinds: ItemKind[] | "all";
  domains: string[] | "all";
}

export interface EditorialActor {
  id: string;
  kind: ActorKind;
  /** اسم الوكيل حين يكون kind = agent. */
  agentName?: string;
  role: string;
  access: EditorialAccess;
  sessionId?: string | null;
  /** التحقق الثنائي لحساب الفاعل البشري، يُحسب في حارس الطلب لأفعال الكتابة (null = لم يُحسب). */
  mfa?: boolean | null;
}

export type EditorialErrorCode =
  | "WRITE_DISABLED"
  /** إعدادات المكتب تشترط التحقق الثنائي لحساب الفاعل. */
  | "MFA_REQUIRED"
  | "FORBIDDEN"
  | "AGENT_CANNOT_DECIDE"
  | "SELF_APPROVAL_FORBIDDEN"
  | "REASON_REQUIRED"
  | "INVALID_INPUT"
  | "EVIDENCE_REQUIRED"
  | "NOT_FOUND"
  | "INVALID_STATE"
  | "OPEN_CHANGE_EXISTS"
  | "ALREADY_DECIDED"
  | "CONFLICT"
  | "NOT_ELIGIBLE"
  | "NO_PRIOR_STATUS"
  /** دفعة لا يُتراجع عنها في المرحلة صفر (قرارات مقترحات الذكاء الاصطناعي). */
  | "NOT_REVERTIBLE"
  | "UNAUTHENTICATED"
  | "PAYLOAD_TOO_LARGE";

const HTTP_STATUS: Record<EditorialErrorCode, number> = {
  WRITE_DISABLED: 423,
  MFA_REQUIRED: 403,
  FORBIDDEN: 403,
  AGENT_CANNOT_DECIDE: 403,
  SELF_APPROVAL_FORBIDDEN: 403,
  REASON_REQUIRED: 400,
  INVALID_INPUT: 400,
  EVIDENCE_REQUIRED: 400,
  NOT_FOUND: 404,
  INVALID_STATE: 409,
  OPEN_CHANGE_EXISTS: 409,
  ALREADY_DECIDED: 409,
  CONFLICT: 409,
  NOT_ELIGIBLE: 422,
  NO_PRIOR_STATUS: 422,
  NOT_REVERTIBLE: 409,
  UNAUTHENTICATED: 401,
  PAYLOAD_TOO_LARGE: 413,
};

export class EditorialError extends Error {
  readonly code: EditorialErrorCode;
  readonly status: number;
  readonly detail?: Record<string, unknown>;

  constructor(code: EditorialErrorCode, message: string, detail?: Record<string, unknown>) {
    super(message);
    this.name = "EditorialError";
    this.code = code;
    this.status = HTTP_STATUS[code];
    this.detail = detail;
  }
}

export function isEditorialError(error: unknown): error is EditorialError {
  return error instanceof EditorialError;
}

/** حالات النظام المسموحة لفعل set_work_status (من قيد verification_verified_status_check؛ بلا حالات المادة). */
export const WORK_STATUSES = [
  "ساري",
  "صادر لم يسرِ بعد",
  "ملغى",
  "مستبدل",
  "ملغى مع بقاء أحكام محددة مؤقتًا",
  "إلغاء جزئي معلّق على شرط",
] as const;

export type WorkStatus = (typeof WORK_STATUSES)[number];

export interface EvidenceInput {
  instrument: string;
  url: string;
  quote: string;
}

export interface WorkStatusChangeInput {
  op: "set_work_status";
  targetId: string;
  status: WorkStatus;
  evidence: EvidenceInput;
  note?: string;
}

export type ChangeInput = WorkStatusChangeInput;

export interface CreateChangeSetInput {
  title: string;
  changes: ChangeInput[];
}

export type AmendmentDecision = "approved" | "rejected" | "approved_with_edit";
export type PrincipleDecision = "approve" | "reject";

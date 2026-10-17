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

export interface EditorialAccess {
  superAdmin: boolean;
  /** حساب وكيل آلي (LEGAL_AGENT_PROPOSE لغير SUPER_ADMIN): يقترح ولا يعتمد ولا ينشر مهما مُنح. */
  agent: boolean;
  laws: boolean;
  rulings: boolean;
  reviewer: boolean;
  qaView: boolean;
}

export interface EditorialActor {
  id: string;
  kind: ActorKind;
  /** اسم الوكيل حين يكون kind = agent. */
  agentName?: string;
  role: string;
  access: EditorialAccess;
  sessionId?: string | null;
}

export type EditorialErrorCode =
  | "WRITE_DISABLED"
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
  | "NO_PRIOR_STATUS";

const HTTP_STATUS: Record<EditorialErrorCode, number> = {
  WRITE_DISABLED: 423,
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

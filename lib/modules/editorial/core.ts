// لبنات الدفعة المشتركة بين التحرير (service.ts) والاستقبال (intake.ts):
// أنواع الصفوف، والقفل، والبصمة، والقرار، وعدّ الموافقات بصلاحية كل معتمِد الحالية (ق-٦).
import { randomUUID } from "node:crypto";
import { canReviewIn, resolveEditorialAccess } from "./access";
import { recordAudit } from "./audit";
import { pgErrorCode, type EditorialDb, type SqlClient } from "./db";
import { payloadHash } from "./payload";
import { bindingFor, policyFor, policySnapshot, type EditorialConfig, type EditorialPolicy } from "./policy";
import { EditorialError, type EditorialActor, type EditorialStatus, type ItemKind } from "./types";

export const newId = () => randomUUID();

// ── أنواع الصفوف ──────────────────────────────────────────────────────────────

export interface ChangeSetRow {
  id: string;
  title: string;
  kind: string;
  author_id: string | null;
  author_kind: string;
  author_agent: string | null;
  status: EditorialStatus;
  reverts_change_set_id: string | null;
  payload_hash: string | null;
  idempotency_key: string | null;
  created_at: Date;
  published_at: Date | null;
}

/** لقطة آخر سجل تحقق للنظام وقت القراءة. */
export interface WorkStatusSnapshot {
  verification_id: string | null;
  status: string | null;
  verified_at: string | null;
  evidence_instrument?: string | null;
  evidence_url?: string | null;
  evidence_quote?: string | null;
}

export interface ChangeRow {
  id: string;
  change_set_id: string;
  target_type: string;
  target_id: string;
  op: string;
  before: WorkStatusSnapshot | null;
  after: { status: string; note?: string | null; revert_of?: string | null } | null;
  evidence_instrument: string | null;
  evidence_url: string | null;
  evidence_quote: string | null;
  source_rank: number | null;
  source_ref: string | null;
  domain: string;
  applied_ref: string | null;
  author_id: string | null;
  author_kind: string;
  author_agent: string | null;
  status: EditorialStatus;
  checks: Record<string, unknown>;
  created_at: Date;
}

export const OPEN_STATUSES = ["draft", "checks_failed", "pending", "approved"] as const;
export const INTAKE_KINDS = ["agent_review", "agent_review_bulk"] as const;

export function isIntakeSet(set: Pick<ChangeSetRow, "kind">): boolean {
  return (INTAKE_KINDS as readonly string[]).includes(set.kind);
}

// ── القراءة والقفل ────────────────────────────────────────────────────────────

export async function lockChangeSet(tx: SqlClient, id: string): Promise<ChangeSetRow> {
  const rows = await tx.query<ChangeSetRow>(`SELECT * FROM change_set WHERE id = $1 FOR UPDATE`, [id]);
  if (!rows[0]) throw new EditorialError("NOT_FOUND", "الدفعة غير موجودة.");
  return rows[0];
}

export async function changesOf(tx: SqlClient, changeSetId: string): Promise<ChangeRow[]> {
  return tx.query<ChangeRow>(`SELECT * FROM editorial_change WHERE change_set_id = $1 ORDER BY created_at, id`, [changeSetId]);
}

export async function setStatus(tx: SqlClient, changeSetId: string, status: EditorialStatus, published = false) {
  await tx.query(
    `UPDATE change_set SET status = $2, published_at = CASE WHEN $3::boolean THEN NOW() ELSE published_at END
      WHERE id = $1 RETURNING id`,
    [changeSetId, status, published],
  );
  await tx.query(`UPDATE editorial_change SET status = $2 WHERE change_set_id = $1 RETURNING id`, [changeSetId, status]);
}

/** مرجع ما كتبه النشر في المصدر: يُضبط مرة واحدة (القاعدة تمنع تغييره بعدها). */
export async function setAppliedRef(tx: SqlClient, changeId: string, ref: string) {
  await tx.query(`UPDATE editorial_change SET applied_ref = $2 WHERE id = $1 RETURNING id`, [changeId, ref]);
}

/** الدفعة المفتوحة على الهدف (قفل D-03)، لإعادة معرّفها مع OPEN_CHANGE_EXISTS. */
export async function openChangeSetFor(db: SqlClient, targetType: string, targetId: string): Promise<string | null> {
  const rows = await db.query<{ change_set_id: string }>(
    `SELECT change_set_id FROM editorial_change
      WHERE target_type = $1 AND target_id = $2 AND status IN ('draft','checks_failed','pending','approved')
      LIMIT 1`,
    [targetType, targetId],
  );
  return rows[0]?.change_set_id ?? null;
}

/**
 * بعد إلغاء المعاملة: إن وصل OPEN_CHANGE_EXISTS بلا معرّف الدفعة المفتوحة (سباق على فهرس القفل)
 * يُقرأ المعرّف بقراءة جديدة ويُعاد الخطأ نفسه معه.
 */
export async function withOpenChangeDetail(db: SqlClient, error: unknown): Promise<unknown> {
  if (!(error instanceof EditorialError) || error.code !== "OPEN_CHANGE_EXISTS" || error.detail?.openChangeSetId) return error;
  const targetId = typeof error.detail?.targetId === "string" ? error.detail.targetId : null;
  const targetType = typeof error.detail?.targetType === "string" ? error.detail.targetType : "work";
  if (!targetId) return error;
  const openChangeSetId = await openChangeSetFor(db, targetType, targetId).catch(() => null);
  return new EditorialError("OPEN_CHANGE_EXISTS", error.message, { ...error.detail, openChangeSetId });
}

/** يسجّل رفض الوصول خارج المعاملة (المعاملة الملغاة لا تحفظ شيئًا). */
export async function auditDenied(db: EditorialDb, actor: EditorialActor, error: unknown, objectType: string, objectId: string) {
  if (error instanceof EditorialError && error.status === 403) {
    await recordAudit(db, actor, {
      action: "access.denied",
      objectType,
      objectId,
      detail: { code: error.code, message: error.message },
    }).catch(() => undefined);
  }
}

// ── الهوية والنطاق ────────────────────────────────────────────────────────────

/** مُعِدّ الدفعة: البشري بمعرّفه، والوكيل باسمه (لا يرسل وكيلٌ دفعةَ وكيل آخر). */
export function isAuthorOf(set: ChangeSetRow, actor: EditorialActor): boolean {
  if (set.author_kind === "human") return actor.kind === "human" && set.author_id === actor.id;
  return actor.kind === "agent" && set.author_agent === (actor.agentName ?? actor.id);
}

/** نوع العنصر للسياسة والنطاق: تغييرات دفعة التراجع «revert»، وغيرها بحسب الفعل. */
export function itemKindOf(set: Pick<ChangeSetRow, "kind">, change: Pick<ChangeRow, "op">): ItemKind {
  if (set.kind === "revert" || set.kind === "emergency_revert") return "revert";
  if (change.op === "review_amendment_op") return "review_amendment_op";
  if (change.op === "review_principle") return "review_principle";
  return "set_work_status";
}

/** كل تغييرات الدفعة في نطاق الفاعل لهذا الفعل، وإلا رفض. */
export function assertSetScope(
  set: ChangeSetRow,
  changes: ChangeRow[],
  allowed: (kind: ItemKind, domain: string) => boolean,
  message: string,
) {
  for (const change of changes) {
    if (!allowed(itemKindOf(set, change), change.domain)) {
      throw new EditorialError("FORBIDDEN", message, { changeId: change.id, targetId: change.target_id });
    }
  }
}

/** السياسات الحالية لأنواع عناصر الدفعة؛ المسار المعطّل يُرفض. */
export function setPolicies(config: EditorialConfig, set: ChangeSetRow, changes: ChangeRow[]) {
  const kinds = Array.from(new Set(changes.map((c) => itemKindOf(set, c))));
  return kinds.map((kind) => ({ kind, policy: policyFor(config, kind) }));
}

// ── البصمة ───────────────────────────────────────────────────────────────────

export function hashOf(set: ChangeSetRow, changes: ChangeRow[]): string {
  return payloadHash(set, changes);
}

/** يضبط بصمة الدفعة عند الإرسال (القاعدة تجمّدها بعد ضبطها)، ويعيدها. */
export async function sealPayload(tx: SqlClient, set: ChangeSetRow, changes: ChangeRow[]): Promise<string> {
  const hash = hashOf(set, changes);
  if (set.payload_hash && set.payload_hash !== hash) {
    throw new EditorialError("CONFLICT", "تغيّرت حمولة الدفعة عمّا أُرسل؛ لا يُكمل شيء.", { changeSetId: set.id });
  }
  if (!set.payload_hash) {
    await tx.query(`UPDATE change_set SET payload_hash = $2 WHERE id = $1 RETURNING id`, [set.id, hash]);
    set.payload_hash = hash;
  }
  return hash;
}

/** يعيد حساب البصمة من الصفوف ويطابقها بالمخزّنة (عند القرار والنشر). */
export function assertPayloadUnchanged(set: ChangeSetRow, changes: ChangeRow[]): string {
  const hash = hashOf(set, changes);
  if (!set.payload_hash || set.payload_hash !== hash) {
    throw new EditorialError("CONFLICT", "بصمة حمولة الدفعة لا تطابق ما أُرسل؛ لا يُكمل شيء.", { changeSetId: set.id });
  }
  return hash;
}

// ── القرار وعدّ الموافقات ─────────────────────────────────────────────────────

/** صف قرار واحد لكل معتمِد في الدفعة (UNIQUE): التكرار = قُرّر من قبل. */
export async function insertDecision(
  tx: SqlClient,
  d: { id?: string; changeSetId: string; reviewerId: string; decision: "approve" | "reject"; reason: string | null; selfApproval: boolean; payloadHash: string },
): Promise<string> {
  const id = d.id ?? newId();
  try {
    await tx.query(
      `INSERT INTO review_decision (id, change_set_id, reviewer_id, decision, reason, self_approval, payload_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [id, d.changeSetId, d.reviewerId, d.decision, d.reason, d.selfApproval, d.payloadHash],
    );
  } catch (error) {
    if (pgErrorCode(error) === "23505") {
      throw new EditorialError("ALREADY_DECIDED", "سبق أن قرّرتَ في هذه الدفعة؛ القرار لا يُكرَّر ولا يُعدَّل.", { changeSetId: d.changeSetId });
    }
    throw error;
  }
  return id;
}

export interface DecisionRow {
  id: string;
  reviewer_id: string;
  decision: "approve" | "reject";
  reason: string | null;
  self_approval: boolean;
  payload_hash: string;
  decided_at: Date;
  role: string | null;
  isActive: boolean | null;
  name: string | null;
}

export async function decisionsOf(tx: SqlClient, changeSetId: string): Promise<DecisionRow[]> {
  return tx.query<DecisionRow>(
    `SELECT d.id, d.reviewer_id, d.decision, d.reason, d.self_approval, d.payload_hash, d.decided_at,
            u.role::text AS role, u."isActive", u.name
       FROM review_decision d LEFT JOIN users u ON u.id = d.reviewer_id
      WHERE d.change_set_id = $1
      ORDER BY d.decided_at, d.id`,
    [changeSetId],
  );
}

export interface ApprovalState {
  /** الموافقات الصالحة الآن: على البصمة الحالية، ومن معتمِد فعّال ما زال مكلَّفًا في نطاق كل تغيير. */
  approvals: number;
  /** أعلى حد أدنى بين سياسات أنواع عناصر الدفعة (لا يقل عن 1). */
  required: number;
  rejected: boolean;
  complete: boolean;
  /** معرّفات المعتمِدين الذين عُدّت موافقاتهم، بترتيب القرار. */
  approvers: string[];
}

/**
 * عدّ الموافقات بصلاحية كل معتمِد **الحالية** (ق-٦): سحب التكليف أو تعطيل الحساب يُسقط موافقته،
 * والموافقة على بصمة غير بصمة الدفعة لا تُعدّ، والاعتماد الذاتي لا يُعدّ إلا للمالك وبسياسة تسمح به،
 * وموافقة المُعِدّ البشري غير المالك لا تُعدّ أبدًا.
 */
export function approvalStateFrom(
  config: EditorialConfig,
  set: ChangeSetRow,
  changes: ChangeRow[],
  decisions: DecisionRow[],
): ApprovalState {
  const kinds = changes.map((c) => ({ kind: itemKindOf(set, c), domain: c.domain }));
  const policies: EditorialPolicy[] = Array.from(new Set(kinds.map((k) => k.kind))).map((k) => policySnapshot(config, k));
  const required = Math.max(1, ...policies.map((p) => p.minApprovals));
  const ownerSelfAllowed = policies.every((p) => p.ownerSelfApproval);
  const rejected = decisions.some((d) => d.decision === "reject");
  const approvers: string[] = [];
  for (const d of decisions) {
    if (d.decision !== "approve" || !set.payload_hash || d.payload_hash !== set.payload_hash) continue;
    if (!d.isActive || !d.role) continue;
    const access = resolveEditorialAccess(d.role, bindingFor(config, d.reviewer_id));
    if (access.agent) continue;
    if (!kinds.every((k) => canReviewIn(access, k.kind, k.domain))) continue;
    const isAuthor = set.author_kind === "human" && set.author_id === d.reviewer_id;
    if (d.self_approval || isAuthor) {
      if (!(access.superAdmin && ownerSelfAllowed && d.self_approval)) continue;
    }
    if (!approvers.includes(d.reviewer_id)) approvers.push(d.reviewer_id);
  }
  const approvals = approvers.length;
  return { approvals, required, rejected, complete: !rejected && changes.length > 0 && approvals >= required, approvers };
}

export async function approvalState(tx: SqlClient, config: EditorialConfig, set: ChangeSetRow, changes: ChangeRow[]): Promise<ApprovalState> {
  return approvalStateFrom(config, set, changes, await decisionsOf(tx, set.id));
}

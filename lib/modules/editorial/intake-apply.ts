// تطبيق قرار مقترح الذكاء الاصطناعي في مصدره عند اكتمال موافقاته (W-07، ق-٦).
// عملية التعديل: صف جديد في uqn_fix.amendment_review (للإضافة فقط بمشغّل no_change)، ولا يُمس نص أي مادة.
// المبدأ: حقل سير العمل reviewStatus وحده، بعد التحقق أن جولة المراجعة لم تتغير.
// منفصل عن intake.ts حتى يستدعيه decideChangeSet بلا حلقة استيراد.
import { recordAudit } from "./audit";
import { decisionsOf, setAppliedRef, setStatus, type ApprovalState, type ChangeRow, type ChangeSetRow } from "./core";
import type { SqlClient } from "./db";
import { EditorialError, type AmendmentDecision, type EditorialActor } from "./types";

export interface OpRow {
  op_id: string;
  instrument_kind: string;
  instrument_no: string | null;
  source_url: string;
  evidence_quote: string;
  confidence: string;
  verbatim_in_source: boolean | null;
  risks: string[] | null;
  target_law_title: string;
}

export function opSourceRef(opId: string): string {
  return `uqn_fix.amendment_op:${opId}`;
}

export function principleSourceRef(principleId: string, round: string): string {
  return `judicial_principles:${principleId}:${round}`;
}

/** يقفل صف العملية ويتحقق أنها بلا قرار في المصدر. */
export async function lockUndecidedOp(tx: SqlClient, opId: string): Promise<OpRow> {
  const rows = await tx.query<OpRow>(
    `SELECT op_id, instrument_kind, instrument_no, source_url, evidence_quote, confidence, verbatim_in_source, risks, target_law_title
       FROM uqn_fix.amendment_op WHERE op_id = $1 FOR UPDATE`,
    [opId],
  );
  const op = rows[0];
  if (!op) throw new EditorialError("NOT_FOUND", "عملية التعديل غير موجودة.", { opId });
  const decided = await tx.query<{ decision: string }>(`SELECT decision FROM uqn_fix.amendment_decision WHERE op_id = $1`, [opId]);
  if (decided[0]) throw new EditorialError("ALREADY_DECIDED", "قُرّرت هذه العملية من قبل.", { opId, decision: decided[0].decision });
  return op;
}

interface PrincipleLockRow {
  id: string;
  title: string;
  reviewStatus: string;
  round: string;
}

export async function lockPrinciple(tx: SqlClient, principleId: string): Promise<PrincipleLockRow> {
  const rows = await tx.query<PrincipleLockRow>(
    `SELECT id, title, "reviewStatus", to_char("updatedAt", 'YYYYMMDD"T"HH24MISS.US') AS round
       FROM judicial_principles WHERE id = $1 FOR UPDATE`,
    [principleId],
  );
  if (!rows[0]) throw new EditorialError("NOT_FOUND", "المبدأ غير موجود.");
  return rows[0];
}

async function applyOp(
  tx: SqlClient,
  actor: EditorialActor,
  set: ChangeSetRow,
  change: ChangeRow,
  reviewer: string,
  note: string | null,
) {
  const op = await lockUndecidedOp(tx, change.target_id);
  const after = (change.after ?? {}) as unknown as { decision?: AmendmentDecision; corrected?: Record<string, unknown> | null };
  if (after.decision !== "approved" && after.decision !== "rejected" && after.decision !== "approved_with_edit") {
    throw new EditorialError("INVALID_STATE", "قرار عملية التعديل في الدفعة غير صالح.", { changeId: change.id });
  }
  const corrected = after.corrected ?? null;
  const rows = await tx.query<{ id: string }>(
    `INSERT INTO uqn_fix.amendment_review (op_id, decision, corrected, reviewer, note)
     VALUES ($1, $2, $3::jsonb, $4, $5) RETURNING id::text AS id`,
    [op.op_id, after.decision, corrected ? JSON.stringify(corrected) : null, reviewer, note],
  );
  await setAppliedRef(tx, change.id, `uqn_fix.amendment_review:${rows[0].id}`);
  await recordAudit(tx, actor, {
    action: "intake.amendment.decide",
    objectType: "amendment_op",
    objectId: op.op_id,
    before: { decision: null },
    after: { decision: after.decision, corrected },
    detail: { changeSetId: set.id, note, target: op.target_law_title, reviewer },
  });
}

async function applyPrinciple(tx: SqlClient, actor: EditorialActor, set: ChangeSetRow, change: ChangeRow, note: string | null) {
  const principle = await lockPrinciple(tx, change.target_id);
  if (principle.reviewStatus !== "needs_review") {
    throw new EditorialError("ALREADY_DECIDED", "روجع هذا المبدأ من قبل.", { reviewStatus: principle.reviewStatus });
  }
  // المقترح لجولة مراجعة بعينها؛ إن أُعيد المبدأ أو عُدّل بعد فتحه فلا يُطبَّق عليه (يُسحب المقترح).
  if (change.source_ref !== principleSourceRef(principle.id, principle.round)) {
    throw new EditorialError("CONFLICT", "تغيّر المبدأ بعد فتح هذا المقترح؛ اسحب المقترح وراجع الجولة الحالية.", {
      principleId: principle.id,
      openChangeSetId: set.id,
    });
  }
  const after = (change.after ?? {}) as unknown as { reviewStatus?: string };
  if (after.reviewStatus !== "reviewed" && after.reviewStatus !== "rejected") {
    throw new EditorialError("INVALID_STATE", "قرار المبدأ في الدفعة غير صالح.", { changeId: change.id });
  }
  // حقل سير عمل لا نص؛ تغييره مسموح في هذا الفعل وحده، والقيمة السابقة في editorial_change.before.
  const updated = await tx.query<{ round: string }>(
    `UPDATE judicial_principles SET "reviewStatus" = $2, "updatedAt" = NOW() WHERE id = $1
     RETURNING to_char("updatedAt", 'YYYYMMDD"T"HH24MISS.US') AS round`,
    [principle.id, after.reviewStatus],
  );
  await setAppliedRef(tx, change.id, principleSourceRef(principle.id, updated[0].round));
  await recordAudit(tx, actor, {
    action: "intake.principle.decide",
    objectType: "principle",
    objectId: principle.id,
    before: { reviewStatus: principle.reviewStatus },
    after: { reviewStatus: after.reviewStatus },
    detail: { changeSetId: set.id, reason: note, via: "editorial-queue" },
  });
}

/**
 * يكتب القرار في المصدر لكل تغييرات الدفعة ثم يقلبها «منشورة»، في المعاملة نفسها.
 * المعتمِد في صف المصدر: معرّفات المعتمِدين الذين عُدّت موافقاتهم (u1+u2…)، والملاحظة: أسبابهم.
 */
export async function applyIntakeSet(
  tx: SqlClient,
  actor: EditorialActor,
  set: ChangeSetRow,
  changes: ChangeRow[],
  state: ApprovalState,
): Promise<void> {
  if (!state.complete) throw new EditorialError("INVALID_STATE", "لم تكتمل موافقات المقترح.");
  const decisions = await decisionsOf(tx, set.id);
  const reviewer = state.approvers.join("+");
  const notes = decisions
    .filter((d) => d.decision === "approve" && state.approvers.includes(d.reviewer_id) && d.reason)
    .map((d) => d.reason as string);
  const note = notes.length ? notes.join(" | ").slice(0, 2000) : null;
  for (const change of changes) {
    if (change.op === "review_amendment_op") await applyOp(tx, actor, set, change, reviewer, note);
    else if (change.op === "review_principle") await applyPrinciple(tx, actor, set, change, note);
    else throw new EditorialError("INVALID_STATE", "فعل غير مدعوم في دفعة الاستقبال.", { changeId: change.id });
  }
  await setStatus(tx, set.id, "published", true);
}

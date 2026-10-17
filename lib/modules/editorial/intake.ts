// W-07: اعتماد مقترحات الذكاء الاصطناعي القائمة من طابور المكتب.
// المصادر تُقرأ مباشرة (لا نسخ مسبق). القرار يُسجَّل في معاملة واحدة:
// change_set + editorial_change (مؤلفه الوكيل) + review_decision (المعتمِد البشري) + audit_event + صف قرار المصدر.
// عملية التعديل: صف جديد في uqn_fix.amendment_review (للإضافة فقط بمشغّل no_change)، ولا يُمس نص أي مادة.
// تعدد الموافقات (ق-٦): حين minApprovals > 1 يبقى المقترح «pending» حتى تكتمل موافقات القرار نفسه.
import { canReviewIn } from "./access";
import { recordAudit, sourceRankFromUrl, stableJson } from "./audit";
import {
  approvalState,
  assertPayloadUnchanged,
  auditDenied,
  changesOf,
  insertDecision,
  lockChangeSet,
  newId,
  sealPayload,
  setStatus,
  type ChangeRow,
  type ChangeSetRow,
} from "./core";
import { pgErrorCode, type EditorialDb, type SqlClient } from "./db";
import { deskTransaction, type DeskContext } from "./desk-tx";
import { hijriToGregorian, parseHijri } from "./hijri";
import { applyIntakeSet, lockPrinciple, lockUndecidedOp, opSourceRef, principleSourceRef, type OpRow } from "./intake-apply";
import { assertDeskIntegrity } from "./integrity";
import { policyFor } from "./policy";
import { EditorialError, type AmendmentDecision, type EditorialActor, type ItemKind, type PrincipleDecision } from "./types";
import { assertEditorialWriteEnabled } from "./write-gate";
import { principleStatusFor } from "@/lib/modules/legal-core/principle-review";

export const AMENDMENT_AGENT = "uqn-fix";
export const PRINCIPLES_AGENT = "principles";

const OP_TYPES = [
  "replace_article_text",
  "replace_paragraph_text",
  "insert_paragraph",
  "insert_article",
  "append_text",
  "delete_paragraph",
  "repeal_article",
  "substitute_phrase",
  "replace_definition",
  "replace_definition_entry",
  "replace_law",
  "repeal_law",
  "rename_law",
] as const;

/** الحقول القابلة للتصحيح هي حقول import_review.py (FIELDS)، ومعها التاريخ الميلادي صريحًا. */
export const CORRECTABLE_FIELDS = [
  "article_number",
  "paragraph_label",
  "effective_from_hijri",
  "effective_from_gregorian",
  "new_text",
  "op_type",
  "old_phrase",
  "new_phrase",
  "target_law_title",
] as const;

export type CorrectableField = (typeof CORRECTABLE_FIELDS)[number];

// ── القراءة ──────────────────────────────────────────────────────────────────

export interface AmendmentQueueItem {
  op_id: string;
  effect_id: string;
  instrument_kind: string;
  instrument_no: string | null;
  instrument_date_hijri: string | null;
  published_hijri: string | null;
  source_url: string;
  target_law_title: string;
  target_hakeem_code: string | null;
  target_resolution: string;
  target_match_status: string | null;
  op_type: string;
  article_number: number | null;
  paragraph_label: string | null;
  term: string | null;
  new_text: string | null;
  old_phrase: string | null;
  new_phrase: string | null;
  effective_from_hijri: string | null;
  effective_from_gregorian: string | null;
  effective_rule: string | null;
  risks: string[];
  confidence: string;
  verbatim_in_source: boolean | null;
  evidence_quote: string;
  bulk_eligible: boolean;
}

export interface AmendmentQueueFilter {
  confidence?: "rule_exact" | "needs_review";
  opType?: string;
  target?: string;
  bulkOnly?: boolean;
  limit?: number;
  offset?: number;
}

const BULK_ELIGIBLE_SQL = `(o.confidence = 'rule_exact' AND o.verbatim_in_source IS TRUE AND coalesce(array_length(o.risks, 1), 0) = 0)`;

// بلا قرار في المصدر ولا قرار منشور في المكتب؛ المقترح المعلّق (pending) يبقى في الطابور لتكمله موافقات أخرى.
const UNDECIDED_SQL = `NOT EXISTS (SELECT 1 FROM uqn_fix.amendment_review r WHERE r.op_id = o.op_id)
  AND NOT EXISTS (SELECT 1 FROM editorial_change c
                   WHERE c.source_ref = 'uqn_fix.amendment_op:' || o.op_id AND c.status IN ('approved', 'published'))`;

function amendmentWhere(filter: AmendmentQueueFilter): { sql: string; params: unknown[] } {
  const parts = [UNDECIDED_SQL];
  const params: unknown[] = [];
  if (filter.confidence) {
    params.push(filter.confidence);
    parts.push(`o.confidence = $${params.length}`);
  }
  if (filter.opType && (OP_TYPES as readonly string[]).includes(filter.opType)) {
    params.push(filter.opType);
    parts.push(`o.op_type = $${params.length}`);
  }
  if (filter.target && filter.target.trim()) {
    params.push(`%${filter.target.trim().slice(0, 100)}%`);
    parts.push(`o.target_law_title ILIKE $${params.length}`);
  }
  if (filter.bulkOnly) parts.push(BULK_ELIGIBLE_SQL);
  return { sql: parts.join(" AND "), params };
}

export async function listAmendmentQueue(
  db: SqlClient,
  filter: AmendmentQueueFilter = {},
): Promise<{ items: AmendmentQueueItem[]; total: number }> {
  const limit = Math.min(Math.max(filter.limit ?? 25, 1), 100);
  const offset = Math.max(filter.offset ?? 0, 0);
  const where = amendmentWhere(filter);
  const totalRows = await db.query<{ total: number }>(
    `SELECT count(*)::int AS total FROM uqn_fix.amendment_op o WHERE ${where.sql}`,
    where.params,
  );
  const params = [...where.params, limit, offset];
  const items = await db.query<AmendmentQueueItem>(
    `SELECT o.op_id, o.effect_id, o.instrument_kind, o.instrument_no, o.instrument_date_hijri, o.published_hijri,
            o.source_url, o.target_law_title, o.target_hakeem_code, o.target_resolution, e.target_match_status,
            o.op_type, o.article_number, o.paragraph_label, o.term, o.new_text, o.old_phrase, o.new_phrase,
            o.effective_from_hijri, o.effective_from_gregorian::text AS effective_from_gregorian, o.effective_rule,
            o.risks, o.confidence, o.verbatim_in_source, o.evidence_quote,
            ${BULK_ELIGIBLE_SQL} AS bulk_eligible
       FROM uqn_fix.amendment_op o
       LEFT JOIN uqn_stage.effect e ON e.effect_id = o.effect_id
      WHERE ${where.sql}
      ORDER BY (o.confidence = 'rule_exact' AND o.verbatim_in_source IS TRUE AND o.target_hakeem_code IS NOT NULL) DESC,
               o.target_law_title, o.article_number NULLS LAST, o.op_id
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return { items, total: totalRows[0]?.total ?? 0 };
}

export interface PrincipleQueueItem {
  id: string;
  title: string;
  principleText: string;
  sourceCaseId: string;
  court: string | null;
  topic: string | null;
  confidence: number | null;
}

export async function listPrincipleQueue(
  db: SqlClient,
  filter: { limit?: number; offset?: number; topic?: string } = {},
): Promise<{ items: PrincipleQueueItem[]; total: number }> {
  const limit = Math.min(Math.max(filter.limit ?? 25, 1), 100);
  const offset = Math.max(filter.offset ?? 0, 0);
  const params: unknown[] = [];
  let topicSql = "";
  if (filter.topic && filter.topic.trim()) {
    params.push(`%${filter.topic.trim().slice(0, 100)}%`);
    topicSql = ` AND (p.topic ILIKE $1 OR p.title ILIKE $1)`;
  }
  const base = `FROM judicial_principles p WHERE p."reviewStatus" = 'needs_review'${topicSql}`;
  const totalRows = await db.query<{ total: number }>(`SELECT count(*)::int AS total ${base}`, params);
  const items = await db.query<PrincipleQueueItem>(
    `SELECT p.id, p.title, p."principleText", p."sourceCaseId", p.court, p.topic, p.confidence
       ${base}
      ORDER BY p.confidence DESC NULLS LAST, p.id
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset],
  );
  return { items, total: totalRows[0]?.total ?? 0 };
}

export interface IntakeCounts {
  amendmentOpsUndecided: number;
  amendmentOpsBulkEligible: number;
  manualEffects: number;
  principlesNeedsReview: number;
  caseLinksNeedsReview: number;
  autoRelations: number;
}

/** عدّادات المصادر للوحة. غياب جدول = صفر مع علامة، لا خطأ. */
export async function intakeCounts(db: SqlClient): Promise<IntakeCounts & { unavailable: string[] }> {
  const unavailable: string[] = [];
  const count = async (label: string, sql: string): Promise<number> => {
    try {
      const rows = await db.query<{ n: number }>(sql);
      return rows[0]?.n ?? 0;
    } catch {
      unavailable.push(label);
      return 0;
    }
  };
  return {
    amendmentOpsUndecided: await count("amendment_op", `SELECT count(*)::int AS n FROM uqn_fix.amendment_op o WHERE ${UNDECIDED_SQL}`),
    amendmentOpsBulkEligible: await count(
      "amendment_op",
      `SELECT count(*)::int AS n FROM uqn_fix.amendment_op o WHERE ${UNDECIDED_SQL} AND ${BULK_ELIGIBLE_SQL}`,
    ),
    manualEffects: await count("amendment_manual", `SELECT count(*)::int AS n FROM uqn_fix.amendment_manual`),
    principlesNeedsReview: await count(
      "judicial_principles",
      `SELECT count(*)::int AS n FROM judicial_principles WHERE "reviewStatus" = 'needs_review'`,
    ),
    caseLinksNeedsReview: await count(
      "legal_article_case_links",
      `SELECT count(*)::int AS n FROM legal_article_case_links WHERE "reviewStatus" = 'needs_review'`,
    ),
    autoRelations: await count(
      "legal_relations",
      `SELECT count(*)::int AS n FROM legal_relations WHERE relation::text = 'RELATED_TO'`,
    ),
    unavailable: Array.from(new Set(unavailable)),
  };
}

// ── التحقق من المدخلات ───────────────────────────────────────────────────────

/** الفاعل هنا محسوب داخل المعاملة من تكليفه الحالي (desk-tx). */
function assertReviewer(actor: EditorialActor, kind: ItemKind) {
  if (actor.access.agent || actor.kind === "agent") {
    throw new EditorialError("AGENT_CANNOT_DECIDE", "حساب الوكيل الآلي يقترح فقط، ولا يعتمد ولا يرفض.");
  }
  if (!canReviewIn(actor.access, kind, "")) throw new EditorialError("FORBIDDEN", "لا تملك صلاحية الاعتماد لهذا النوع ضمن تكليفك.");
}

/** رفض مبكر قبل المعاملة لما لا يحتاج القاعدة (الوكيل)، حتى لا يُفتح قفل بلا داع. */
function assertNotAgent(actor: EditorialActor) {
  if (actor.access.agent || actor.kind === "agent") {
    throw new EditorialError("AGENT_CANNOT_DECIDE", "حساب الوكيل الآلي يقترح فقط، ولا يعتمد ولا يرفض.");
  }
}

function cleanNote(note: unknown): string | null {
  if (typeof note !== "string") return null;
  const text = note.trim();
  return text ? text.slice(0, 2000) : null;
}

function isRealGregorian(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split("-").map(Number);
  const ms = Date.UTC(y, m - 1, d);
  return new Date(ms).toISOString().slice(0, 10) === v;
}

export function validateCorrection(raw: unknown): Partial<Record<CorrectableField, string | number>> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new EditorialError("INVALID_INPUT", "«موافق مع تصحيح» يحتاج حقلًا مصحَّحًا واحدًا على الأقل.");
  }
  const out: Partial<Record<CorrectableField, string | number>> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!(CORRECTABLE_FIELDS as readonly string[]).includes(key)) {
      throw new EditorialError("INVALID_INPUT", `الحقل ${key} لا يُصحَّح من هنا.`, { field: key });
    }
    if (value === null || value === undefined || (typeof value === "string" && !value.trim())) continue;
    const field = key as CorrectableField;
    if (field === "article_number") {
      const n = typeof value === "number" ? value : Number(String(value).trim());
      if (!Number.isInteger(n) || n < 1 || n > 10000) throw new EditorialError("INVALID_INPUT", "رقم المادة غير صالح.");
      out.article_number = n;
    } else if (field === "op_type") {
      if (!(OP_TYPES as readonly string[]).includes(String(value))) throw new EditorialError("INVALID_INPUT", "نوع العملية غير صالح.");
      out.op_type = String(value);
    } else if (field === "effective_from_hijri") {
      const v = String(value).trim();
      if (!/^1[3-5]\d{2}-\d{1,2}-\d{1,2}$/.test(v)) throw new EditorialError("INVALID_INPUT", "التاريخ الهجري بصيغة 1447-05-17.");
      // ق-١١: اليوم يجب أن يكون موجودًا في تقويم أم القرى (لا شهر 13 ولا يوم 30 في شهر من 29).
      if (!hijriToGregorian(v)) {
        throw new EditorialError("INVALID_INPUT", "التاريخ الهجري غير موجود في تقويم أم القرى.", { field, value: v });
      }
      const h = parseHijri(v);
      out.effective_from_hijri = h ? `${h.y}-${String(h.m).padStart(2, "0")}-${String(h.d).padStart(2, "0")}` : v;
    } else if (field === "effective_from_gregorian") {
      const v = String(value).trim();
      if (!isRealGregorian(v)) throw new EditorialError("INVALID_INPUT", "التاريخ الميلادي بصيغة 2026-10-17.");
      out.effective_from_gregorian = v;
    } else {
      out[field] = String(value).trim().slice(0, 20000);
    }
  }
  if (!Object.keys(out).length) {
    throw new EditorialError("INVALID_INPUT", "«موافق مع تصحيح» يحتاج حقلًا مصحَّحًا واحدًا على الأقل.");
  }
  // اتساق التاريخين إن صُحّحا معًا؛ ولا يُشتق أحدهما من الآخر بصمت (لا قيمة مخترعة في المصدر).
  if (typeof out.effective_from_hijri === "string" && typeof out.effective_from_gregorian === "string") {
    const expected = hijriToGregorian(out.effective_from_hijri);
    if (expected !== out.effective_from_gregorian) {
      throw new EditorialError("INVALID_INPUT", `التاريخ الميلادي لا يطابق الهجري بتقويم أم القرى (يقابله ${expected}).`, {
        hijri: out.effective_from_hijri,
        gregorian: out.effective_from_gregorian,
        expectedGregorian: expected,
      });
    }
  }
  return out;
}

// ── مقترح القرار وتعدد الموافقات (ق-٦) ───────────────────────────────────────
// موافقة واحدة (الافتراضي): القرار يُطبَّق في المصدر فورًا كما كان.
// minApprovals > 1: أول موافقة تفتح دفعة «pending» مفتاحها source_ref وبصمتها بصمة القرار،
// والموافقات اللاحقة تُقبل على القرار نفسه فقط، وأي رفض من معتمِد يرفض المقترح فيعود العنصر إلى الطابور بلا قرار.

export interface IntakeDecisionResult {
  changeSetId: string;
  status: "pending" | "published" | "rejected";
  approvals: number;
  requiredApprovals: number;
}

/** دفعة الاستقبال تُنشأ مسودة (ق-٨)، ثم تُدرج تغييراتها، ثم تُختم بصمتها وتُقلب. */
async function openAgentChangeSet(tx: SqlClient, title: string, kind: "agent_review" | "agent_review_bulk", agent: string): Promise<ChangeSetRow> {
  const id = newId();
  await tx.query(
    `INSERT INTO change_set (id, title, kind, author_kind, author_agent, status)
     VALUES ($1, $2, $3, 'agent', $4, 'draft') RETURNING id`,
    [id, title.slice(0, 200), kind, agent],
  );
  return lockChangeSet(tx, id);
}

async function insertIntakeChange(
  tx: SqlClient,
  set: ChangeSetRow,
  row: {
    targetType: "amendment_op" | "principle";
    targetId: string;
    op: "review_amendment_op" | "review_principle";
    before: unknown;
    after: unknown;
    evidenceInstrument?: string | null;
    evidenceUrl?: string | null;
    evidenceQuote?: string | null;
    sourceRef: string;
    agent: string;
    checks: Record<string, unknown>;
  },
): Promise<void> {
  try {
    await tx.query(
      `INSERT INTO editorial_change (id, change_set_id, target_type, target_id, op, before, after,
          evidence_instrument, evidence_url, evidence_quote, source_rank, source_ref, author_kind, author_agent, status, checks)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10, $11, $12, 'agent', $13, 'draft', $14::jsonb)
       RETURNING id`,
      [
        newId(),
        set.id,
        row.targetType,
        row.targetId,
        row.op,
        JSON.stringify(row.before),
        JSON.stringify(row.after),
        row.evidenceInstrument ?? null,
        row.evidenceUrl ?? null,
        row.evidenceQuote ?? null,
        row.evidenceUrl ? sourceRankFromUrl(row.evidenceUrl) : null,
        row.sourceRef,
        row.agent,
        JSON.stringify(row.checks),
      ],
    );
  } catch (error) {
    if (pgErrorCode(error) === "23505") throw new EditorialError("ALREADY_DECIDED", "قُرّر هذا العنصر من قبل.", { sourceRef: row.sourceRef });
    throw error;
  }
}

/** المقترح المعلّق على المصدر (إن وُجد) مقفولًا. */
async function pendingProposal(tx: SqlClient, sourceRef: string): Promise<{ set: ChangeSetRow; change: ChangeRow } | null> {
  const rows = await tx.query<ChangeRow>(
    `SELECT * FROM editorial_change WHERE source_ref = $1 AND status = 'pending' ORDER BY created_at LIMIT 1`,
    [sourceRef],
  );
  if (!rows[0]) return null;
  const set = await lockChangeSet(tx, rows[0].change_set_id);
  if (set.status !== "pending") return null;
  return { set, change: rows[0] };
}

/** موافقة على مقترح معلّق: تُعدّ ثم يُطبَّق القرار إن اكتمل الحد. */
async function approveProposal(
  ctx: DeskContext,
  set: ChangeSetRow,
  reason: string | null,
): Promise<IntakeDecisionResult> {
  const { tx, actor, config } = ctx;
  const changes = await changesOf(tx, set.id);
  const hash = assertPayloadUnchanged(set, changes);
  await insertDecision(tx, { changeSetId: set.id, reviewerId: actor.id, decision: "approve", reason, selfApproval: false, payloadHash: hash });
  const state = await approvalState(tx, config, set, changes);
  if (state.complete) {
    await applyIntakeSet(tx, actor, set, changes, state);
    return { changeSetId: set.id, status: "published", approvals: state.approvals, requiredApprovals: state.required };
  }
  await recordAudit(tx, actor, {
    action: "intake.proposal.approve",
    objectType: "change_set",
    objectId: set.id,
    detail: { approvals: state.approvals, required: state.required, reason },
  });
  return { changeSetId: set.id, status: "pending", approvals: state.approvals, requiredApprovals: state.required };
}

/** يقرّر عنصر استقبال: ينضم إلى مقترح معلّق، أو يرفضه، أو يفتح مقترحًا جديدًا. */
async function decideIntakeItem(
  ctx: DeskContext,
  item: {
    sourceRef: string;
    after: Record<string, unknown>;
    rejecting: boolean;
    reason: string | null;
    open: () => Promise<ChangeSetRow>;
  },
): Promise<IntakeDecisionResult> {
  const { tx, actor, config } = ctx;
  const pending = await pendingProposal(tx, item.sourceRef);
  if (pending) {
    if (stableJson(pending.change.after) === stableJson(item.after)) return approveProposal(ctx, pending.set, item.reason);
    const changes = await changesOf(tx, pending.set.id);
    if (item.rejecting) {
      // رفض أي معتمِد يرفض المقترح المعلّق؛ العنصر يعود إلى الطابور بلا قرار في المصدر.
      const hash = assertPayloadUnchanged(pending.set, changes);
      await insertDecision(tx, { changeSetId: pending.set.id, reviewerId: actor.id, decision: "reject", reason: item.reason, selfApproval: false, payloadHash: hash });
      await setStatus(tx, pending.set.id, "rejected");
      await recordAudit(tx, actor, {
        action: "intake.proposal.reject",
        objectType: "change_set",
        objectId: pending.set.id,
        detail: { reason: item.reason, pending: pending.change.after },
      });
      const state = await approvalState(tx, config, pending.set, changes);
      return { changeSetId: pending.set.id, status: "rejected", approvals: state.approvals, requiredApprovals: state.required };
    }
    throw new EditorialError("CONFLICT", "على هذا العنصر مقترح قرار معلّق مختلف؛ وافق على القرار نفسه أو ارفض المقترح أولًا.", {
      openChangeSetId: pending.set.id,
      pendingDecision: pending.change.after,
    });
  }
  const set = await item.open();
  const changes = await changesOf(tx, set.id);
  const hash = await sealPayload(tx, set, changes);
  await insertDecision(tx, { changeSetId: set.id, reviewerId: actor.id, decision: "approve", reason: item.reason, selfApproval: false, payloadHash: hash });
  const state = await approvalState(tx, config, set, changes);
  if (state.complete) {
    await applyIntakeSet(tx, actor, set, changes, state);
    return { changeSetId: set.id, status: "published", approvals: state.approvals, requiredApprovals: state.required };
  }
  await setStatus(tx, set.id, "pending");
  await recordAudit(tx, actor, {
    action: "intake.proposal.open",
    objectType: "change_set",
    objectId: set.id,
    detail: { sourceRef: item.sourceRef, after: item.after, approvals: state.approvals, required: state.required },
  });
  return { changeSetId: set.id, status: "pending", approvals: state.approvals, requiredApprovals: state.required };
}

function opChangeRow(op: OpRow, after: Record<string, unknown>) {
  return {
    targetType: "amendment_op" as const,
    targetId: op.op_id,
    op: "review_amendment_op" as const,
    before: { decision: null },
    after,
    evidenceInstrument: [op.instrument_kind, op.instrument_no].filter(Boolean).join(" "),
    evidenceUrl: op.source_url,
    evidenceQuote: op.evidence_quote,
    sourceRef: opSourceRef(op.op_id),
    agent: AMENDMENT_AGENT,
    checks: { source: AMENDMENT_AGENT, confidence: op.confidence, verbatim_in_source: op.verbatim_in_source },
  };
}

// ── قرار عملية التعديل ───────────────────────────────────────────────────────

export async function decideAmendmentOp(
  db: EditorialDb,
  actor: EditorialActor,
  opId: string,
  input: { decision: AmendmentDecision; corrected?: unknown; note?: unknown },
): Promise<IntakeDecisionResult & { decision: AmendmentDecision }> {
  assertEditorialWriteEnabled();
  await assertDeskIntegrity(db);
  try {
    assertNotAgent(actor);
    const decision = input?.decision;
    if (decision !== "approved" && decision !== "rejected" && decision !== "approved_with_edit") {
      throw new EditorialError("INVALID_INPUT", "القرار: approved أو rejected أو approved_with_edit.");
    }
    const note = cleanNote(input.note);
    if (decision === "rejected" && !note) throw new EditorialError("REASON_REQUIRED", "الرفض يحتاج سببًا مكتوبًا.");
    const corrected = decision === "approved_with_edit" ? validateCorrection(input.corrected) : null;
    const id = typeof opId === "string" ? opId.trim() : "";
    if (!id) throw new EditorialError("INVALID_INPUT", "معرّف العملية مطلوب.");

    return await deskTransaction(db, actor, async (ctx) => {
      assertReviewer(ctx.actor, "review_amendment_op");
      policyFor(ctx.config, "review_amendment_op");
      const op = await lockUndecidedOp(ctx.tx, id);
      // بصمة القرار: القرار والتصحيح وحدهما (الملاحظة سبب المعتمِد في صف قراره).
      const after = { decision, corrected };
      const result = await decideIntakeItem(ctx, {
        sourceRef: opSourceRef(op.op_id),
        after,
        rejecting: decision === "rejected",
        reason: note,
        open: async () => {
          const set = await openAgentChangeSet(ctx.tx, `قرار عملية تعديل ${op.op_id} — ${op.target_law_title}`, "agent_review", AMENDMENT_AGENT);
          await insertIntakeChange(ctx.tx, set, opChangeRow(op, after));
          return set;
        },
      });
      return { ...result, decision };
    });
  } catch (error) {
    await auditDenied(db, actor, error, "amendment_op", String(opId));
    throw error;
  }
}

export const BULK_LIMIT = 50;

export async function bulkApproveAmendmentOps(
  db: EditorialDb,
  actor: EditorialActor,
  opIds: unknown,
  noteRaw?: unknown,
): Promise<IntakeDecisionResult & { approved: number }> {
  assertEditorialWriteEnabled();
  await assertDeskIntegrity(db);
  try {
    assertNotAgent(actor);
    if (!Array.isArray(opIds) || !opIds.length) throw new EditorialError("INVALID_INPUT", "اختر عملية واحدة على الأقل.");
    const ids = Array.from(new Set(opIds.map((x) => String(x).trim()).filter(Boolean)));
    if (ids.length > BULK_LIMIT) throw new EditorialError("INVALID_INPUT", `الاعتماد الجماعي حتى ${BULK_LIMIT} عملية في المرة.`);
    const note = cleanNote(noteRaw);

    return await deskTransaction(db, actor, async (ctx) => {
      const { tx } = ctx;
      assertReviewer(ctx.actor, "review_amendment_op");
      policyFor(ctx.config, "review_amendment_op");
      const ops: OpRow[] = [];
      for (const id of ids) {
        const op = await lockUndecidedOp(tx, id);
        // الأهلية كما في الأمر: rule_exact، ومطابقة حرفية لمصدرها، وبلا مخاطر.
        const eligible = op.confidence === "rule_exact" && op.verbatim_in_source === true && !(op.risks ?? []).length;
        if (!eligible) {
          throw new EditorialError("NOT_ELIGIBLE", "الاعتماد الجماعي لعمليات rule_exact المطابقة حرفيًّا لمصدرها وبلا مخاطر فقط.", {
            opId: op.op_id,
          });
        }
        const pending = await pendingProposal(tx, opSourceRef(op.op_id));
        if (pending) {
          throw new EditorialError("CONFLICT", "على إحدى العمليات مقترح قرار معلّق؛ أكمله من دفعته أو أخرجها من الاختيار.", {
            opId: op.op_id,
            openChangeSetId: pending.set.id,
          });
        }
        ops.push(op);
      }
      const set = await openAgentChangeSet(tx, `اعتماد جماعي لـ ${ops.length} عملية تعديل`, "agent_review_bulk", AMENDMENT_AGENT);
      for (const op of ops) await insertIntakeChange(tx, set, opChangeRow(op, { decision: "approved", corrected: null }));
      const changes = await changesOf(tx, set.id);
      const hash = await sealPayload(tx, set, changes);
      await insertDecision(tx, { changeSetId: set.id, reviewerId: ctx.actor.id, decision: "approve", reason: note, selfApproval: false, payloadHash: hash });
      const state = await approvalState(tx, ctx.config, set, changes);
      if (state.complete) {
        await applyIntakeSet(tx, ctx.actor, set, changes, state);
        return { changeSetId: set.id, status: "published" as const, approvals: state.approvals, requiredApprovals: state.required, approved: ops.length };
      }
      // تعدد الموافقات: تكمله موافقات المعتمِدين الآخرين على الدفعة نفسها (decide في مسار الدفعات).
      await setStatus(tx, set.id, "pending");
      await recordAudit(tx, ctx.actor, {
        action: "intake.proposal.open",
        objectType: "change_set",
        objectId: set.id,
        detail: { bulk: true, ops: ops.length, approvals: state.approvals, required: state.required },
      });
      return { changeSetId: set.id, status: "pending" as const, approvals: state.approvals, requiredApprovals: state.required, approved: 0 };
    });
  } catch (error) {
    await auditDenied(db, actor, error, "amendment_op", "bulk");
    throw error;
  }
}

// ── قرار المبدأ ──────────────────────────────────────────────────────────────

export async function decidePrinciple(
  db: EditorialDb,
  actor: EditorialActor,
  principleId: string,
  input: { decision: PrincipleDecision; reason?: unknown },
): Promise<IntakeDecisionResult & { reviewStatus: string }> {
  assertEditorialWriteEnabled();
  await assertDeskIntegrity(db);
  try {
    assertNotAgent(actor);
    if (input?.decision !== "approve" && input?.decision !== "reject") {
      throw new EditorialError("INVALID_INPUT", "القرار: approve أو reject.");
    }
    const reason = cleanNote(input.reason);
    if (input.decision === "reject" && !reason) throw new EditorialError("REASON_REQUIRED", "الرفض يحتاج سببًا مكتوبًا.");
    const id = typeof principleId === "string" ? principleId.trim() : "";
    if (!id) throw new EditorialError("INVALID_INPUT", "معرّف المبدأ مطلوب.");

    return await deskTransaction(db, actor, async (ctx) => {
      assertReviewer(ctx.actor, "review_principle");
      policyFor(ctx.config, "review_principle");
      const principle = await lockPrinciple(ctx.tx, id);
      if (principle.reviewStatus !== "needs_review") {
        throw new EditorialError("ALREADY_DECIDED", "روجع هذا المبدأ من قبل.", { reviewStatus: principle.reviewStatus });
      }
      const reviewStatus = principleStatusFor(input.decision);
      const after = { reviewStatus };
      // مفتاح عدم التكرار لكل جولة مراجعة: إعادة المبدأ إلى «يحتاج مراجعة» تفتح جولة جديدة.
      const sourceRef = principleSourceRef(principle.id, principle.round);
      const result = await decideIntakeItem(ctx, {
        sourceRef,
        after,
        rejecting: reviewStatus === "rejected",
        reason,
        open: async () => {
          const set = await openAgentChangeSet(ctx.tx, `مراجعة مبدأ: ${principle.title}`, "agent_review", PRINCIPLES_AGENT);
          await insertIntakeChange(ctx.tx, set, {
            targetType: "principle",
            targetId: principle.id,
            op: "review_principle",
            before: { reviewStatus: principle.reviewStatus },
            after,
            sourceRef,
            agent: PRINCIPLES_AGENT,
            checks: { source: PRINCIPLES_AGENT },
          });
          return set;
        },
      });
      return { ...result, reviewStatus: result.status === "published" ? reviewStatus : principle.reviewStatus };
    });
  } catch (error) {
    await auditDenied(db, actor, error, "principle", String(principleId));
    throw error;
  }
}

// W-07: اعتماد مقترحات الذكاء الاصطناعي القائمة من طابور المكتب.
// المصادر تُقرأ مباشرة (لا نسخ مسبق). القرار يُسجَّل في معاملة واحدة:
// change_set + editorial_change (مؤلفه الوكيل) + review_decision (المعتمِد البشري) + audit_event + صف قرار المصدر.
// عملية التعديل: صف جديد في uqn_fix.amendment_review (للإضافة فقط بمشغّل no_change)، ولا يُمس نص أي مادة.
import { randomUUID } from "node:crypto";
import { canReview } from "./access";
import { recordAudit, sourceRankFromUrl } from "./audit";
import { pgErrorCode, type EditorialDb, type SqlClient } from "./db";
import { EditorialError, type AmendmentDecision, type EditorialActor, type PrincipleDecision } from "./types";
import { assertEditorialWriteEnabled } from "./write-gate";
import { assertDeskIntegrity } from "./integrity";
import { payloadHash } from "./payload";
import { insertDecision } from "./service";
import { principleStatusFor } from "@/lib/modules/legal-core/principle-review";

const ID = () => randomUUID();

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

const UNDECIDED_SQL = `NOT EXISTS (SELECT 1 FROM uqn_fix.amendment_review r WHERE r.op_id = o.op_id)
  AND NOT EXISTS (SELECT 1 FROM editorial_change c
                   WHERE c.source_ref = 'uqn_fix.amendment_op:' || o.op_id AND c.status NOT IN ('rejected', 'reverted'))`;

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

function assertReviewer(actor: EditorialActor) {
  if (actor.access.agent || actor.kind === "agent") {
    throw new EditorialError("AGENT_CANNOT_DECIDE", "حساب الوكيل الآلي يقترح فقط، ولا يعتمد ولا يرفض.");
  }
  if (!canReview(actor.access)) throw new EditorialError("FORBIDDEN", "لا تملك صلاحية الاعتماد.");
}

function cleanNote(note: unknown): string | null {
  if (typeof note !== "string") return null;
  const text = note.trim();
  return text ? text.slice(0, 2000) : null;
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
      out.effective_from_hijri = v;
    } else if (field === "effective_from_gregorian") {
      const v = String(value).trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) {
        throw new EditorialError("INVALID_INPUT", "التاريخ الميلادي بصيغة 2026-10-17.");
      }
      out.effective_from_gregorian = v;
    } else {
      out[field] = String(value).trim().slice(0, 20000);
    }
  }
  if (!Object.keys(out).length) {
    throw new EditorialError("INVALID_INPUT", "«موافق مع تصحيح» يحتاج حقلًا مصحَّحًا واحدًا على الأقل.");
  }
  return out;
}

// ── قرار عملية التعديل ───────────────────────────────────────────────────────

interface OpRow {
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

async function lockUndecidedOp(tx: SqlClient, opId: string): Promise<OpRow> {
  const rows = await tx.query<OpRow>(
    `SELECT op_id, instrument_kind, instrument_no, source_url, evidence_quote, confidence, verbatim_in_source, risks, target_law_title
       FROM uqn_fix.amendment_op WHERE op_id = $1 FOR UPDATE`,
    [opId],
  );
  const op = rows[0];
  if (!op) throw new EditorialError("NOT_FOUND", "عملية التعديل غير موجودة.", { opId });
  const decided = await tx.query<{ decision: string }>(
    `SELECT decision FROM uqn_fix.amendment_decision WHERE op_id = $1`,
    [opId],
  );
  if (decided[0]) throw new EditorialError("ALREADY_DECIDED", "قُرّرت هذه العملية من قبل.", { opId, decision: decided[0].decision });
  return op;
}

function opSourceRef(opId: string): string {
  return `uqn_fix.amendment_op:${opId}`;
}

/** تغيير القرار في دفعة مسودة (القاعدة لا تقبل الإدراج في غيرها)؛ لا يكتب في المصدر. */
async function insertOpChange(
  tx: SqlClient,
  changeSetId: string,
  op: OpRow,
  after: { decision: AmendmentDecision; corrected: Record<string, unknown> | null },
): Promise<string> {
  const id = ID();
  try {
    await tx.query(
      `INSERT INTO editorial_change (id, change_set_id, target_type, target_id, op, before, after,
          evidence_instrument, evidence_url, evidence_quote, source_rank, source_ref, author_kind, author_agent, status, checks)
       VALUES ($1, $2, 'amendment_op', $3, 'review_amendment_op', $4::jsonb, $5::jsonb, $6, $7, $8, $9, $10, 'agent', $11, 'draft', $12::jsonb)
       RETURNING id`,
      [
        id,
        changeSetId,
        op.op_id,
        JSON.stringify({ decision: null }),
        JSON.stringify(after),
        [op.instrument_kind, op.instrument_no].filter(Boolean).join(" "),
        op.source_url,
        op.evidence_quote,
        sourceRankFromUrl(op.source_url),
        opSourceRef(op.op_id),
        AMENDMENT_AGENT,
        JSON.stringify({ source: AMENDMENT_AGENT, confidence: op.confidence, verbatim_in_source: op.verbatim_in_source }),
      ],
    );
  } catch (error) {
    if (pgErrorCode(error) === "23505") {
      throw new EditorialError("ALREADY_DECIDED", "قُرّرت هذه العملية من قبل.", { opId: op.op_id });
    }
    throw error;
  }
  return id;
}

/** يكتب القرار في المصدر: صف جديد في uqn_fix.amendment_review (للإضافة فقط بمشغّل no_change). */
async function applyOpDecision(
  tx: SqlClient,
  actor: EditorialActor,
  changeSetId: string,
  changeId: string,
  op: OpRow,
  input: { decision: AmendmentDecision; corrected: Record<string, unknown> | null; note: string | null; reviewer: string },
): Promise<void> {
  const rows = await tx.query<{ id: string }>(
    `INSERT INTO uqn_fix.amendment_review (op_id, decision, corrected, reviewer, note)
     VALUES ($1, $2, $3::jsonb, $4, $5) RETURNING id::text AS id`,
    [op.op_id, input.decision, input.corrected ? JSON.stringify(input.corrected) : null, input.reviewer, input.note],
  );
  await tx.query(`UPDATE editorial_change SET applied_ref = $2 WHERE id = $1 RETURNING id`, [
    changeId,
    `uqn_fix.amendment_review:${rows[0].id}`,
  ]);
  await recordAudit(tx, actor, {
    action: "intake.amendment.decide",
    objectType: "amendment_op",
    objectId: op.op_id,
    before: { decision: null },
    after: { decision: input.decision, corrected: input.corrected },
    detail: { changeSetId, note: input.note, target: op.target_law_title, reviewer: input.reviewer },
  });
}

interface IntakeChangeRow {
  id: string;
  target_type: string;
  target_id: string;
  op: string;
  before: unknown;
  after: unknown;
  evidence_instrument: string | null;
  evidence_url: string | null;
  evidence_quote: string | null;
  source_rank: number | null;
  source_ref: string | null;
  domain: string;
  status: string;
}

async function intakeChanges(tx: SqlClient, changeSetId: string): Promise<IntakeChangeRow[]> {
  return tx.query<IntakeChangeRow>(`SELECT * FROM editorial_change WHERE change_set_id = $1 ORDER BY created_at, id`, [changeSetId]);
}

/** يضبط بصمة الدفعة من صفوفها ويعيدها. */
async function sealIntakeSet(tx: SqlClient, changeSetId: string, kind: string): Promise<string> {
  const hash = payloadHash({ id: changeSetId, kind, reverts_change_set_id: null }, await intakeChanges(tx, changeSetId));
  await tx.query(`UPDATE change_set SET payload_hash = $2 WHERE id = $1 RETURNING id`, [changeSetId, hash]);
  return hash;
}

async function markIntakePublished(tx: SqlClient, changeSetId: string) {
  await tx.query(`UPDATE change_set SET status = 'published', published_at = NOW() WHERE id = $1 RETURNING id`, [changeSetId]);
  await tx.query(`UPDATE editorial_change SET status = 'published' WHERE change_set_id = $1 RETURNING id`, [changeSetId]);
}

/** دفعة الاستقبال تُنشأ مسودة (ق-٨)، ثم تُدرج تغييراتها، ثم تُختم بصمتها وتُقلب. */
async function openAgentChangeSet(tx: SqlClient, title: string, kind: "agent_review" | "agent_review_bulk", agent: string) {
  const id = ID();
  await tx.query(
    `INSERT INTO change_set (id, title, kind, author_kind, author_agent, status)
     VALUES ($1, $2, $3, 'agent', $4, 'draft') RETURNING id`,
    [id, title.slice(0, 200), kind, agent],
  );
  return id;
}

export async function decideAmendmentOp(
  db: EditorialDb,
  actor: EditorialActor,
  opId: string,
  input: { decision: AmendmentDecision; corrected?: unknown; note?: unknown },
): Promise<{ changeSetId: string; decision: AmendmentDecision }> {
  assertEditorialWriteEnabled();
  await assertDeskIntegrity(db);
  try {
    assertReviewer(actor);
    const decision = input?.decision;
    if (decision !== "approved" && decision !== "rejected" && decision !== "approved_with_edit") {
      throw new EditorialError("INVALID_INPUT", "القرار: approved أو rejected أو approved_with_edit.");
    }
    const note = cleanNote(input.note);
    if (decision === "rejected" && !note) throw new EditorialError("REASON_REQUIRED", "الرفض يحتاج سببًا مكتوبًا.");
    const corrected = decision === "approved_with_edit" ? validateCorrection(input.corrected) : null;
    const id = typeof opId === "string" ? opId.trim() : "";
    if (!id) throw new EditorialError("INVALID_INPUT", "معرّف العملية مطلوب.");

    return await db.transaction(async (tx) => {
      const op = await lockUndecidedOp(tx, id);
      const changeSetId = await openAgentChangeSet(tx, `قرار عملية تعديل ${op.op_id} — ${op.target_law_title}`, "agent_review", AMENDMENT_AGENT);
      const changeId = await insertOpChange(tx, changeSetId, op, { decision, corrected });
      const hash = await sealIntakeSet(tx, changeSetId, "agent_review");
      // الموافقة على مقترح القرار (أيًّا كان القرار نفسه: موافقة أو رفض أو تصحيح).
      await insertDecision(tx, { changeSetId, reviewerId: actor.id, decision: "approve", reason: note, selfApproval: false, payloadHash: hash });
      await applyOpDecision(tx, actor, changeSetId, changeId, op, { decision, corrected, note, reviewer: actor.id });
      await markIntakePublished(tx, changeSetId);
      return { changeSetId, decision };
    });
  } catch (error) {
    await auditDeniedIntake(db, actor, error, "amendment_op", String(opId));
    throw error;
  }
}

export const BULK_LIMIT = 50;

export async function bulkApproveAmendmentOps(
  db: EditorialDb,
  actor: EditorialActor,
  opIds: unknown,
  noteRaw?: unknown,
): Promise<{ changeSetId: string; approved: number }> {
  assertEditorialWriteEnabled();
  await assertDeskIntegrity(db);
  try {
    assertReviewer(actor);
    if (!Array.isArray(opIds) || !opIds.length) throw new EditorialError("INVALID_INPUT", "اختر عملية واحدة على الأقل.");
    const ids = Array.from(new Set(opIds.map((x) => String(x).trim()).filter(Boolean)));
    if (ids.length > BULK_LIMIT) throw new EditorialError("INVALID_INPUT", `الاعتماد الجماعي حتى ${BULK_LIMIT} عملية في المرة.`);
    const note = cleanNote(noteRaw);

    return await db.transaction(async (tx) => {
      const ops: OpRow[] = [];
      for (const id of ids) {
        const op = await lockUndecidedOp(tx, id);
        const eligible = op.confidence === "rule_exact" && op.verbatim_in_source === true && !(op.risks ?? []).length;
        if (!eligible) {
          throw new EditorialError("NOT_ELIGIBLE", "الاعتماد الجماعي لعمليات rule_exact المطابقة حرفيًّا لمصدرها وبلا مخاطر فقط.", {
            opId: op.op_id,
          });
        }
        ops.push(op);
      }
      const changeSetId = await openAgentChangeSet(tx, `اعتماد جماعي لـ ${ops.length} عملية تعديل`, "agent_review_bulk", AMENDMENT_AGENT);
      const changeIds: string[] = [];
      for (const op of ops) changeIds.push(await insertOpChange(tx, changeSetId, op, { decision: "approved", corrected: null }));
      const hash = await sealIntakeSet(tx, changeSetId, "agent_review_bulk");
      await insertDecision(tx, { changeSetId, reviewerId: actor.id, decision: "approve", reason: note, selfApproval: false, payloadHash: hash });
      for (let i = 0; i < ops.length; i += 1) {
        await applyOpDecision(tx, actor, changeSetId, changeIds[i], ops[i], { decision: "approved", corrected: null, note, reviewer: actor.id });
      }
      await markIntakePublished(tx, changeSetId);
      return { changeSetId, approved: ops.length };
    });
  } catch (error) {
    await auditDeniedIntake(db, actor, error, "amendment_op", "bulk");
    throw error;
  }
}

// ── قرار المبدأ ──────────────────────────────────────────────────────────────

export async function decidePrinciple(
  db: EditorialDb,
  actor: EditorialActor,
  principleId: string,
  input: { decision: PrincipleDecision; reason?: unknown },
): Promise<{ changeSetId: string; reviewStatus: string }> {
  assertEditorialWriteEnabled();
  await assertDeskIntegrity(db);
  try {
    assertReviewer(actor);
    if (input?.decision !== "approve" && input?.decision !== "reject") {
      throw new EditorialError("INVALID_INPUT", "القرار: approve أو reject.");
    }
    const reason = cleanNote(input.reason);
    if (input.decision === "reject" && !reason) throw new EditorialError("REASON_REQUIRED", "الرفض يحتاج سببًا مكتوبًا.");
    const id = typeof principleId === "string" ? principleId.trim() : "";
    if (!id) throw new EditorialError("INVALID_INPUT", "معرّف المبدأ مطلوب.");

    return await db.transaction(async (tx) => {
      const rows = await tx.query<{ id: string; title: string; reviewStatus: string; round: string }>(
        `SELECT id, title, "reviewStatus", to_char("updatedAt", 'YYYYMMDD"T"HH24MISS.US') AS round
           FROM judicial_principles WHERE id = $1 FOR UPDATE`,
        [id],
      );
      const principle = rows[0];
      if (!principle) throw new EditorialError("NOT_FOUND", "المبدأ غير موجود.");
      if (principle.reviewStatus !== "needs_review") {
        throw new EditorialError("ALREADY_DECIDED", "روجع هذا المبدأ من قبل.", { reviewStatus: principle.reviewStatus });
      }
      const reviewStatus = principleStatusFor(input.decision);
      const changeSetId = await openAgentChangeSet(tx, `مراجعة مبدأ: ${principle.title}`, "agent_review", PRINCIPLES_AGENT);
      const changeId = ID();
      try {
        await tx.query(
          `INSERT INTO editorial_change (id, change_set_id, target_type, target_id, op, before, after,
              source_ref, author_kind, author_agent, status, checks)
           VALUES ($1, $2, 'principle', $3, 'review_principle', $4::jsonb, $5::jsonb, $6, 'agent', $7, 'draft', $8::jsonb)
           RETURNING id`,
          [
            changeId,
            changeSetId,
            principle.id,
            JSON.stringify({ reviewStatus: principle.reviewStatus }),
            JSON.stringify({ reviewStatus }),
            // مفتاح عدم التكرار لكل جولة مراجعة: إعادة المبدأ إلى «يحتاج مراجعة» تفتح جولة جديدة.
            `judicial_principles:${principle.id}:${principle.round}`,
            PRINCIPLES_AGENT,
            JSON.stringify({ source: PRINCIPLES_AGENT }),
          ],
        );
      } catch (error) {
        if (pgErrorCode(error) === "23505") throw new EditorialError("ALREADY_DECIDED", "روجع هذا المبدأ من قبل.");
        throw error;
      }
      const hash = await sealIntakeSet(tx, changeSetId, "agent_review");
      await insertDecision(tx, { changeSetId, reviewerId: actor.id, decision: "approve", reason, selfApproval: false, payloadHash: hash });
      // حقل سير عمل لا نص؛ تغييره مسموح في هذا الفعل وحده، والقيمة السابقة في editorial_change.before.
      const updated = await tx.query<{ round: string }>(
        `UPDATE judicial_principles SET "reviewStatus" = $2, "updatedAt" = NOW() WHERE id = $1
         RETURNING to_char("updatedAt", 'YYYYMMDD"T"HH24MISS.US') AS round`,
        [principle.id, reviewStatus],
      );
      await tx.query(`UPDATE editorial_change SET applied_ref = $2 WHERE id = $1 RETURNING id`, [
        changeId,
        `judicial_principles:${principle.id}:${updated[0].round}`,
      ]);
      await markIntakePublished(tx, changeSetId);
      await recordAudit(tx, actor, {
        action: "intake.principle.decide",
        objectType: "principle",
        objectId: principle.id,
        before: { reviewStatus: principle.reviewStatus },
        after: { reviewStatus },
        detail: { changeSetId, reason, via: "editorial-queue" },
      });
      return { changeSetId, reviewStatus };
    });
  } catch (error) {
    await auditDeniedIntake(db, actor, error, "principle", String(principleId));
    throw error;
  }
}

async function auditDeniedIntake(db: EditorialDb, actor: EditorialActor, error: unknown, objectType: string, objectId: string) {
  if (error instanceof EditorialError && error.status === 403) {
    await recordAudit(db, actor, {
      action: "access.denied",
      objectType,
      objectId,
      detail: { code: error.code, message: error.message },
    }).catch(() => undefined);
  }
}

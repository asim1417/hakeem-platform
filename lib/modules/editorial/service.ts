// دورة حياة التغيير في مكتب التحرير: مسودة ← فحص ← طابور ← اعتماد بمعتمِد غير المُعِدّ ← نشر ذري ← تراجع.
// النشر يكتب صفوفًا جديدة في جداول السند (verification) ولا يغيّر قيمة قائمة.
import { randomUUID } from "node:crypto";
import { canProposeLaws, canReview } from "./access";
import { fingerprint, recordAudit, sourceRankFromUrl } from "./audit";
import { pgErrorCode, type EditorialDb, type SqlClient } from "./db";
import {
  EditorialError,
  WORK_STATUSES,
  type ChangeInput,
  type CreateChangeSetInput,
  type EditorialActor,
  type EditorialStatus,
  type EvidenceInput,
} from "./types";
import { assertEditorialWriteEnabled } from "./write-gate";
import { assertDeskIntegrity } from "./integrity";

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
  created_at: Date;
  published_at: Date | null;
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
  author_id: string | null;
  author_kind: string;
  author_agent: string | null;
  status: EditorialStatus;
  checks: Record<string, unknown>;
  created_at: Date;
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

// ── أدوات داخلية ──────────────────────────────────────────────────────────────

const ID = () => randomUUID();

function invalid(message: string, detail?: Record<string, unknown>): never {
  throw new EditorialError("INVALID_INPUT", message, detail);
}

function cleanText(value: unknown, field: string, { min = 1, max = 4000 } = {}): string {
  if (typeof value !== "string") invalid(`الحقل ${field} مطلوب.`, { field });
  const text = value.trim();
  if (text.length < min) invalid(`الحقل ${field} قصير جدًّا.`, { field });
  if (text.length > max) invalid(`الحقل ${field} أطول من المسموح.`, { field });
  return text;
}

/** المبدأ 3: لا حالة بلا سند كامل (الأداة، والرابط، والاقتباس). */
export function validateEvidence(evidence: EvidenceInput | undefined): EvidenceInput {
  if (!evidence || typeof evidence !== "object") {
    throw new EditorialError("EVIDENCE_REQUIRED", "لا تُحفظ حالة بلا سند: الأداة ورابطها واقتباسها.");
  }
  const instrument = typeof evidence.instrument === "string" ? evidence.instrument.trim() : "";
  const url = typeof evidence.url === "string" ? evidence.url.trim() : "";
  const quote = typeof evidence.quote === "string" ? evidence.quote.trim() : "";
  const missing = [!instrument && "الأداة", !url && "الرابط", !quote && "الاقتباس"].filter(Boolean);
  if (missing.length) {
    throw new EditorialError("EVIDENCE_REQUIRED", `السند ناقص: ${missing.join("، ")}.`, { missing });
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new EditorialError("EVIDENCE_REQUIRED", "رابط السند غير صالح.");
  }
  if (parsed.protocol !== "https:") throw new EditorialError("EVIDENCE_REQUIRED", "رابط السند يجب أن يكون https.");
  if (quote.length < 10) throw new EditorialError("EVIDENCE_REQUIRED", "اقتباس السند قصير جدًّا.");
  if (instrument.length > 300 || url.length > 1000 || quote.length > 4000) invalid("السند أطول من المسموح.");
  return { instrument, url, quote };
}

async function latestWorkVerification(db: SqlClient, workId: string): Promise<WorkStatusSnapshot> {
  const rows = await db.query<{
    id: string;
    verified_status: string;
    verified_at: Date;
    evidence_instrument: string | null;
    evidence_url: string | null;
    evidence_quote: string | null;
  }>(
    `SELECT id, verified_status, verified_at, evidence_instrument, evidence_url, evidence_quote
       FROM verification
      WHERE object_type = 'work' AND object_id = $1
      ORDER BY verified_at DESC, id DESC
      LIMIT 1`,
    [workId],
  );
  const row = rows[0];
  if (!row) return { verification_id: null, status: null, verified_at: null };
  return {
    verification_id: row.id,
    status: row.verified_status,
    verified_at: new Date(row.verified_at).toISOString(),
    evidence_instrument: row.evidence_instrument,
    evidence_url: row.evidence_url,
    evidence_quote: row.evidence_quote,
  };
}

async function lockChangeSet(tx: SqlClient, id: string): Promise<ChangeSetRow> {
  const rows = await tx.query<ChangeSetRow>(`SELECT * FROM change_set WHERE id = $1 FOR UPDATE`, [id]);
  if (!rows[0]) throw new EditorialError("NOT_FOUND", "الدفعة غير موجودة.");
  return rows[0];
}

async function changesOf(tx: SqlClient, changeSetId: string): Promise<ChangeRow[]> {
  return tx.query<ChangeRow>(
    `SELECT * FROM editorial_change WHERE change_set_id = $1 ORDER BY created_at, id`,
    [changeSetId],
  );
}

async function setStatus(tx: SqlClient, changeSetId: string, status: EditorialStatus, published = false) {
  await tx.query(
    `UPDATE change_set SET status = $2, published_at = CASE WHEN $3::boolean THEN NOW() ELSE published_at END
      WHERE id = $1 RETURNING id`,
    [changeSetId, status, published],
  );
  await tx.query(`UPDATE editorial_change SET status = $2 WHERE change_set_id = $1 RETURNING id`, [changeSetId, status]);
}

/** يسجّل رفض الوصول خارج المعاملة (المعاملة الملغاة لا تحفظ شيئًا). */
async function auditDenied(db: EditorialDb, actor: EditorialActor, error: unknown, objectType: string, objectId: string) {
  if (error instanceof EditorialError && error.status === 403) {
    await recordAudit(db, actor, {
      action: "access.denied",
      objectType,
      objectId,
      detail: { code: error.code, message: error.message },
    }).catch(() => undefined);
  }
}

/** مُعِدّ الدفعة: البشري بمعرّفه، والوكيل باسمه (لا يرسل وكيلٌ دفعةَ وكيل آخر). */
function isAuthorOf(set: ChangeSetRow, actor: EditorialActor): boolean {
  if (set.author_kind === "human") return actor.kind === "human" && set.author_id === actor.id;
  return actor.kind === "agent" && set.author_agent === (actor.agentName ?? actor.id);
}

function authorOf(actor: EditorialActor) {
  return actor.kind === "agent"
    ? { authorId: null, authorKind: "agent", authorAgent: actor.agentName ?? actor.id }
    : { authorId: actor.id, authorKind: "human", authorAgent: null };
}

async function insertChange(
  tx: SqlClient,
  actor: EditorialActor,
  changeSetId: string,
  input: ChangeInput,
  before: WorkStatusSnapshot,
  extra: { revertOf?: string | null; sourceRef?: string | null } = {},
): Promise<string> {
  const id = ID();
  const author = authorOf(actor);
  try {
    await tx.query(
      `INSERT INTO editorial_change (id, change_set_id, target_type, target_id, op, before, after,
          evidence_instrument, evidence_url, evidence_quote, source_rank, source_ref, author_id, author_kind, author_agent, status)
       VALUES ($1, $2, 'work', $3, 'set_work_status', $4::jsonb, $5::jsonb, $6, $7, $8, $9, $10, $11, $12, $13, 'draft')
       RETURNING id`,
      [
        id,
        changeSetId,
        input.targetId,
        JSON.stringify(before),
        JSON.stringify({ status: input.status, note: input.note ?? null, revert_of: extra.revertOf ?? null }),
        input.evidence.instrument,
        input.evidence.url,
        input.evidence.quote,
        sourceRankFromUrl(input.evidence.url),
        extra.sourceRef ?? null,
        author.authorId,
        author.authorKind,
        author.authorAgent,
      ],
    );
  } catch (error) {
    if (pgErrorCode(error) === "23505") {
      throw new EditorialError("OPEN_CHANGE_EXISTS", "على هذا النظام تغيير مفتوح لم يُحسم؛ أكمله أو ارفضه أولًا.", {
        targetId: input.targetId,
      });
    }
    throw error;
  }
  return id;
}

// ── الإنشاء ──────────────────────────────────────────────────────────────────

function validateChangeInput(raw: ChangeInput): ChangeInput {
  if (!raw || raw.op !== "set_work_status") invalid("نوع الفعل غير مدعوم في هذه المرحلة.");
  const targetId = cleanText(raw.targetId, "targetId", { max: 100 });
  if (!(WORK_STATUSES as readonly string[]).includes(raw.status)) invalid("حالة النظام غير مسموحة.", { status: raw.status });
  const evidence = validateEvidence(raw.evidence);
  const note = raw.note === undefined || raw.note === null ? undefined : cleanText(raw.note, "note", { max: 1000 });
  return { op: "set_work_status", targetId, status: raw.status, evidence, note };
}

export async function createChangeSet(
  db: EditorialDb,
  actor: EditorialActor,
  input: CreateChangeSetInput,
): Promise<{ changeSetId: string; changeIds: string[] }> {
  assertEditorialWriteEnabled();
  await assertDeskIntegrity(db);
  if (!canProposeLaws(actor.access)) throw new EditorialError("FORBIDDEN", "لا تملك صلاحية تحرير الأنظمة.");
  const title = cleanText(input?.title, "title", { min: 3, max: 200 });
  if (!Array.isArray(input.changes) || input.changes.length < 1 || input.changes.length > 50) {
    invalid("الدفعة تحوي من تغيير واحد إلى 50 تغييرًا.");
  }
  const changes = input.changes.map(validateChangeInput);
  const targets = new Set(changes.map((c) => c.targetId));
  if (targets.size !== changes.length) invalid("لا يتكرر النظام نفسه في الدفعة الواحدة.");

  return db.transaction(async (tx) => {
    const changeSetId = ID();
    const author = authorOf(actor);
    await tx.query(
      `INSERT INTO change_set (id, title, kind, author_id, author_kind, author_agent, status)
       VALUES ($1, $2, 'manual', $3, $4, $5, 'draft') RETURNING id`,
      [changeSetId, title, author.authorId, author.authorKind, author.authorAgent],
    );
    const changeIds: string[] = [];
    for (const change of changes) {
      const exists = await tx.query<{ id: string }>(`SELECT id FROM legal_systems WHERE id = $1`, [change.targetId]);
      if (!exists[0]) throw new EditorialError("NOT_FOUND", "النظام غير موجود.", { targetId: change.targetId });
      const before = await latestWorkVerification(tx, change.targetId);
      const changeId = await insertChange(tx, actor, changeSetId, change, before);
      changeIds.push(changeId);
      await recordAudit(tx, actor, {
        action: "change.create",
        objectType: "work",
        objectId: change.targetId,
        before,
        after: { status: change.status },
        detail: { changeSetId, changeId, op: change.op },
      });
    }
    await recordAudit(tx, actor, {
      action: "change_set.create",
      objectType: "change_set",
      objectId: changeSetId,
      detail: { title, changes: changeIds.length },
    });
    return { changeSetId, changeIds };
  });
}

// ── الفحوص (W-02) ────────────────────────────────────────────────────────────

export interface CheckResult {
  ok: boolean;
  evidence: boolean;
  required: boolean;
  noConflict: boolean;
  fingerprint: boolean;
  message?: string;
}

async function checkChange(tx: SqlClient, change: ChangeRow): Promise<CheckResult> {
  const result: CheckResult = { ok: true, evidence: true, required: true, noConflict: true, fingerprint: true };
  try {
    validateEvidence({
      instrument: change.evidence_instrument ?? "",
      url: change.evidence_url ?? "",
      quote: change.evidence_quote ?? "",
    });
  } catch (error) {
    result.evidence = false;
    result.message = error instanceof Error ? error.message : "السند ناقص.";
  }
  if (change.op !== "set_work_status" || !change.after?.status || !(WORK_STATUSES as readonly string[]).includes(change.after.status)) {
    result.required = false;
    result.message = result.message ?? "حقول الفعل الإلزامية ناقصة.";
  }
  const current = await latestWorkVerification(tx, change.target_id);
  const before = change.before ?? { verification_id: null, status: null, verified_at: null };
  if ((current.verification_id ?? null) !== (before.verification_id ?? null)) {
    result.noConflict = false;
    result.message = result.message ?? "سُجّلت حالة أحدث لهذا النظام بعد قراءة المُعِدّ؛ أعد إنشاء التغيير على الحالة الحالية.";
  }
  if (fingerprint(current) !== fingerprint(before)) {
    result.fingerprint = false;
    result.message = result.message ?? "بصمة الحالة السابقة تغيّرت.";
  }
  result.ok = result.evidence && result.required && result.noConflict && result.fingerprint;
  return result;
}

export async function submitChangeSet(
  db: EditorialDb,
  actor: EditorialActor,
  changeSetId: string,
): Promise<{ status: EditorialStatus; checks: Record<string, CheckResult> }> {
  assertEditorialWriteEnabled();
  await assertDeskIntegrity(db);
  return db.transaction(async (tx) => {
    const set = await lockChangeSet(tx, changeSetId);
    if (!isAuthorOf(set, actor) && !actor.access.superAdmin) throw new EditorialError("FORBIDDEN", "يرسل الدفعة مُعِدّها.");
    if (set.status !== "draft" && set.status !== "checks_failed") {
      throw new EditorialError("INVALID_STATE", "لا تُرسل إلا مسودة أو دفعة فشلت فحوصها.");
    }
    const changes = await changesOf(tx, changeSetId);
    const checks: Record<string, CheckResult> = {};
    let allOk = true;
    for (const change of changes) {
      const result = await checkChange(tx, change);
      checks[change.id] = result;
      allOk = allOk && result.ok;
      await tx.query(`UPDATE editorial_change SET checks = $2::jsonb, status = $3 WHERE id = $1 RETURNING id`, [
        change.id,
        JSON.stringify(result),
        result.ok ? "pending" : "checks_failed",
      ]);
    }
    const status: EditorialStatus = allOk ? "pending" : "checks_failed";
    await tx.query(`UPDATE change_set SET status = $2 WHERE id = $1 RETURNING id`, [changeSetId, status]);
    await recordAudit(tx, actor, {
      action: allOk ? "change_set.submit" : "change_set.checks_failed",
      objectType: "change_set",
      objectId: changeSetId,
      detail: { checks },
    });
    return { status, checks };
  });
}

// ── القرار (W-02، W-03) ──────────────────────────────────────────────────────

export async function decideChangeSet(
  db: EditorialDb,
  actor: EditorialActor,
  changeSetId: string,
  input: { decision: "approve" | "reject"; reason?: string | null },
): Promise<{ status: EditorialStatus; selfApproval: boolean; decisionId: string }> {
  assertEditorialWriteEnabled();
  await assertDeskIntegrity(db);
  try {
    if (actor.access.agent || actor.kind === "agent") {
      throw new EditorialError("AGENT_CANNOT_DECIDE", "حساب الوكيل الآلي يقترح فقط، ولا يعتمد ولا يرفض.");
    }
    if (!canReview(actor.access)) throw new EditorialError("FORBIDDEN", "لا تملك صلاحية الاعتماد.");
    if (input?.decision !== "approve" && input?.decision !== "reject") invalid("القرار: approve أو reject.");
    const reason = typeof input.reason === "string" && input.reason.trim() ? input.reason.trim().slice(0, 2000) : null;
    if (input.decision === "reject" && !reason) throw new EditorialError("REASON_REQUIRED", "الرفض يحتاج سببًا مكتوبًا.");

    return await db.transaction(async (tx) => {
      const set = await lockChangeSet(tx, changeSetId);
      if (set.status !== "pending") throw new EditorialError("INVALID_STATE", "لا يُقرَّر إلا ما في الطابور.");
      const isOwnChange = set.author_kind === "human" && set.author_id === actor.id;
      let selfApproval = false;
      if (isOwnChange && input.decision === "approve") {
        if (!actor.access.superAdmin) {
          throw new EditorialError("SELF_APPROVAL_FORBIDDEN", "لا يعتمد المُعِدّ تغييره؛ يعتمده معتمِد آخر.");
        }
        if (!reason) throw new EditorialError("REASON_REQUIRED", "الاعتماد الذاتي للمالك يحتاج سببًا مكتوبًا.");
        selfApproval = true;
      }
      const decisionId = ID();
      await tx.query(
        `INSERT INTO review_decision (id, change_set_id, reviewer_id, decision, reason, self_approval)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [decisionId, changeSetId, actor.id, input.decision, reason, selfApproval],
      );
      const status: EditorialStatus = input.decision === "approve" ? "approved" : "rejected";
      await setStatus(tx, changeSetId, status);
      await recordAudit(tx, actor, {
        action: input.decision === "approve" ? "change_set.approve" : "change_set.reject",
        objectType: "change_set",
        objectId: changeSetId,
        detail: { decisionId, selfApproval, reason },
      });
      return { status, selfApproval, decisionId };
    });
  } catch (error) {
    await auditDenied(db, actor, error, "change_set", changeSetId);
    throw error;
  }
}

// ── النشر الذري (W-03) ───────────────────────────────────────────────────────

async function applyWorkStatus(tx: SqlClient, actor: EditorialActor, change: ChangeRow): Promise<string> {
  const current = await latestWorkVerification(tx, change.target_id);
  if ((current.verification_id ?? null) !== (change.before?.verification_id ?? null)) {
    throw new EditorialError("CONFLICT", "تغيّرت حالة النظام بعد الاعتماد؛ لم يُنشر شيء من الدفعة.", {
      changeId: change.id,
      targetId: change.target_id,
    });
  }
  const verificationId = ID();
  await tx.query(
    `INSERT INTO verification (id, object_type, object_id, verified_status, evidence_instrument, evidence_url, evidence_quote,
        method, verified_by, supersedes_verification_id)
     VALUES ($1, 'work', $2, $3, $4, $5, $6, 'manual', $7, $8) RETURNING id`,
    [
      verificationId,
      change.target_id,
      change.after?.status,
      change.evidence_instrument,
      change.evidence_url,
      change.evidence_quote,
      `editorial-desk:${actor.id}:${change.id}`,
      current.verification_id,
    ],
  );
  return verificationId;
}

export async function publishChangeSet(
  db: EditorialDb,
  actor: EditorialActor,
  changeSetId: string,
): Promise<{ published: number; verificationIds: string[] }> {
  assertEditorialWriteEnabled();
  await assertDeskIntegrity(db);
  try {
    if (actor.access.agent || actor.kind === "agent") {
      throw new EditorialError("AGENT_CANNOT_DECIDE", "حساب الوكيل الآلي لا ينشر.");
    }
    if (!canReview(actor.access)) throw new EditorialError("FORBIDDEN", "لا تملك صلاحية النشر.");
    return await db.transaction(async (tx) => {
      const set = await lockChangeSet(tx, changeSetId);
      if (set.status !== "approved") throw new EditorialError("INVALID_STATE", "لا يُنشر إلا المعتمد.");
      const changes = await changesOf(tx, changeSetId);
      const verificationIds: string[] = [];
      for (const change of changes) {
        if (change.op !== "set_work_status") throw new EditorialError("INVALID_STATE", "فعل غير مدعوم للنشر.");
        const verificationId = await applyWorkStatus(tx, actor, change);
        verificationIds.push(verificationId);
        await tx.query(
          `INSERT INTO index_sync (id, change_set_id, target_type, target_id) VALUES ($1, $2, $3, $4) RETURNING id`,
          [ID(), changeSetId, change.target_type, change.target_id],
        );
        await recordAudit(tx, actor, {
          action: "change.publish",
          objectType: "work",
          objectId: change.target_id,
          before: change.before,
          after: { status: change.after?.status, verification_id: verificationId },
          detail: { changeSetId, changeId: change.id },
        });
      }
      await setStatus(tx, changeSetId, "published", true);
      if (set.reverts_change_set_id) {
        await setStatus(tx, set.reverts_change_set_id, "reverted");
      }
      await recordAudit(tx, actor, {
        action: "change_set.publish",
        objectType: "change_set",
        objectId: changeSetId,
        detail: { verificationIds, reverts: set.reverts_change_set_id },
      });
      return { published: changes.length, verificationIds };
    });
  } catch (error) {
    await auditDenied(db, actor, error, "change_set", changeSetId);
    throw error;
  }
}

// ── التراجع (W-05) ───────────────────────────────────────────────────────────

export async function revertChangeSet(
  db: EditorialDb,
  actor: EditorialActor,
  changeSetId: string,
  input: { reason: string; emergency?: boolean },
): Promise<{ revertChangeSetId: string; status: EditorialStatus }> {
  assertEditorialWriteEnabled();
  await assertDeskIntegrity(db);
  const reason = cleanText(input?.reason, "reason", { min: 3, max: 2000 });
  const emergency = input.emergency === true;
  try {
    if (emergency && !actor.access.superAdmin) {
      throw new EditorialError("FORBIDDEN", "التراجع العاجل بخطوة واحدة للمالك وحده.");
    }
    if (!emergency && !canProposeLaws(actor.access) && !canReview(actor.access)) {
      throw new EditorialError("FORBIDDEN", "لا تملك صلاحية التراجع.");
    }
    return await db.transaction(async (tx) => {
      const original = await lockChangeSet(tx, changeSetId);
      if (original.status !== "published") throw new EditorialError("INVALID_STATE", "لا يُتراجع إلا عن دفعة منشورة.");
      const openRevert = await tx.query<{ id: string }>(
        `SELECT id FROM change_set WHERE reverts_change_set_id = $1 AND status NOT IN ('rejected') LIMIT 1`,
        [changeSetId],
      );
      if (openRevert[0]) throw new EditorialError("INVALID_STATE", "يوجد تراجع قائم عن هذه الدفعة.", { id: openRevert[0].id });
      const changes = await changesOf(tx, changeSetId);
      const revertId = ID();
      const author = authorOf(actor);
      await tx.query(
        `INSERT INTO change_set (id, title, kind, author_id, author_kind, author_agent, status, reverts_change_set_id)
         VALUES ($1, $2, $3, $4, $5, $6, 'draft', $7) RETURNING id`,
        [revertId, `تراجع: ${original.title}`.slice(0, 200), emergency ? "emergency_revert" : "revert", author.authorId, author.authorKind, author.authorAgent, changeSetId],
      );
      for (const change of changes) {
        const prior = change.before;
        if (!prior?.verification_id || !prior.status) {
          throw new EditorialError("NO_PRIOR_STATUS", "لا حالة سابقة موثّقة لهذا النظام؛ التراجع يحتاج حالة بسند.", {
            targetId: change.target_id,
          });
        }
        // لا يُخترع سند: التراجع يعيد الحالة السابقة بسندها كما كان، فإن نقص فلا تراجع آلي.
        if (!prior.evidence_instrument || !prior.evidence_url || !prior.evidence_quote) {
          throw new EditorialError("NO_PRIOR_STATUS", "الحالة السابقة بلا سند كامل؛ لا يُخترع سند للتراجع. أنشئ تغييرًا جديدًا بسنده.", {
            targetId: change.target_id,
            priorVerificationId: prior.verification_id,
          });
        }
        const row: ChangeInput = {
          op: "set_work_status",
          targetId: change.target_id,
          status: prior.status as ChangeInput["status"],
          evidence: { instrument: prior.evidence_instrument, url: prior.evidence_url, quote: prior.evidence_quote },
          note: `تراجع: ${reason}`.slice(0, 1000),
        };
        const before = await latestWorkVerification(tx, change.target_id);
        await insertChange(tx, actor, revertId, row, before, { revertOf: change.id });
      }
      await recordAudit(tx, actor, {
        action: emergency ? "change_set.emergency_revert" : "change_set.revert_requested",
        objectType: "change_set",
        objectId: changeSetId,
        detail: { revertChangeSetId: revertId, reason },
      });

      if (!emergency) return { revertChangeSetId: revertId, status: "draft" as EditorialStatus };

      // المسار العاجل للمالك: فحص ثم قرار ذاتي مسبَّب ثم نشر، في المعاملة نفسها.
      const revertChanges = await changesOf(tx, revertId);
      for (const change of revertChanges) {
        const result = await checkChange(tx, change);
        if (!result.ok) {
          throw new EditorialError(result.evidence ? "CONFLICT" : "EVIDENCE_REQUIRED", result.message ?? "فشل فحص التراجع.");
        }
        await tx.query(`UPDATE editorial_change SET checks = $2::jsonb WHERE id = $1 RETURNING id`, [change.id, JSON.stringify(result)]);
      }
      await tx.query(
        `INSERT INTO review_decision (id, change_set_id, reviewer_id, decision, reason, self_approval)
         VALUES ($1, $2, $3, 'approve', $4, TRUE) RETURNING id`,
        [ID(), revertId, actor.id, `تراجع عاجل: ${reason}`],
      );
      for (const change of revertChanges) {
        const verificationId = await applyWorkStatus(tx, actor, change);
        await tx.query(
          `INSERT INTO index_sync (id, change_set_id, target_type, target_id) VALUES ($1, $2, $3, $4) RETURNING id`,
          [ID(), revertId, change.target_type, change.target_id],
        );
        await recordAudit(tx, actor, {
          action: "change.publish",
          objectType: "work",
          objectId: change.target_id,
          before: change.before,
          after: { status: change.after?.status, verification_id: verificationId },
          detail: { changeSetId: revertId, changeId: change.id, emergency: true },
        });
      }
      await setStatus(tx, revertId, "published", true);
      await setStatus(tx, changeSetId, "reverted");
      await recordAudit(tx, actor, {
        action: "change_set.publish",
        objectType: "change_set",
        objectId: revertId,
        detail: { emergency: true, reverts: changeSetId, notifyOwner: true },
      });
      return { revertChangeSetId: revertId, status: "published" as EditorialStatus };
    });
  } catch (error) {
    await auditDenied(db, actor, error, "change_set", changeSetId);
    throw error;
  }
}

// ── السحب ────────────────────────────────────────────────────────────────────

/**
 * سحب دفعة لم تُنشر حتى لا تقفل أهدافها إلى الأبد: يسحبها مُعِدّها أو المالك،
 * ويسحب المعتمِد ما فشلت فحوصه. تصير «مرفوضة» ويُسجَّل السحب؛ لا حذف.
 */
export async function withdrawChangeSet(
  db: EditorialDb,
  actor: EditorialActor,
  changeSetId: string,
  input: { reason: string },
): Promise<{ status: EditorialStatus }> {
  assertEditorialWriteEnabled();
  await assertDeskIntegrity(db);
  const reason = cleanText(input?.reason, "reason", { min: 3, max: 2000 });
  try {
    return await db.transaction(async (tx) => {
      const set = await lockChangeSet(tx, changeSetId);
      if (!["draft", "checks_failed", "pending"].includes(set.status)) {
        throw new EditorialError("INVALID_STATE", "لا تُسحب إلا مسودة أو دفعة فشلت فحوصها أو في الطابور.");
      }
      const allowed =
        isAuthorOf(set, actor) || actor.access.superAdmin || (set.status === "checks_failed" && canReview(actor.access));
      if (!allowed) throw new EditorialError("FORBIDDEN", "يسحب الدفعة مُعِدّها أو المالك، ويسحب المعتمِد ما فشلت فحوصه.");
      await setStatus(tx, changeSetId, "rejected");
      await recordAudit(tx, actor, {
        action: "change_set.withdraw",
        objectType: "change_set",
        objectId: changeSetId,
        detail: { reason, from: set.status },
      });
      return { status: "rejected" as EditorialStatus };
    });
  } catch (error) {
    await auditDenied(db, actor, error, "change_set", changeSetId);
    throw error;
  }
}

// ── القراءة ──────────────────────────────────────────────────────────────────

export async function listChangeSets(
  db: SqlClient,
  filter: { status?: EditorialStatus | "open"; limit?: number } = {},
): Promise<Array<ChangeSetRow & { changes: number }>> {
  const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);
  const where =
    filter.status === "open"
      ? `WHERE s.status IN ('draft','checks_failed','pending','approved')`
      : filter.status
        ? `WHERE s.status = $2`
        : "";
  const params: unknown[] = [limit];
  if (filter.status && filter.status !== "open") params.push(filter.status);
  return db.query(
    `SELECT s.*, (SELECT count(*)::int FROM editorial_change c WHERE c.change_set_id = s.id) AS changes
       FROM change_set s ${where}
      ORDER BY s.created_at DESC
      LIMIT $1`,
    params,
  );
}

export async function getChangeSet(db: SqlClient, id: string): Promise<{ set: ChangeSetRow; changes: ChangeRow[] } | null> {
  const sets = await db.query<ChangeSetRow>(`SELECT * FROM change_set WHERE id = $1`, [id]);
  if (!sets[0]) return null;
  return { set: sets[0], changes: await changesOf(db, id) };
}

// قراءات اللوحة: سجل التدقيق، وعدّادات الطوابير، وعقد الواجهة (الدفعات بتفاصيلها).
import { canReadAudit, canRequestRevertIn, inScope } from "./access";
import { approvalStateFrom, authoredBy, isIntakeSet, itemKindOf, type ChangeRow, type ChangeSetRow, type DecisionRow } from "./core";
import type { SqlClient } from "./db";
import { DEFAULT_EDITORIAL_CONFIG, loadEditorialConfig } from "./policy";
import { EditorialError, type EditorialActor } from "./types";

export { intakeCounts } from "./intake";

export interface AuditRow {
  id: string;
  actor_id: string | null;
  actor_kind: string;
  action: string;
  object_type: string;
  object_id: string;
  before_hash: string | null;
  after_hash: string | null;
  detail: Record<string, unknown> | null;
  at: Date;
}

/** يقرؤه صاحب عرض الجودة أو المعتمِد فقط (ق-١٢)؛ الحكم هنا في طبقة البيانات لا في الصفحة وحدها. */
export async function listAudit(
  db: SqlClient,
  viewer: EditorialActor,
  filter: { action?: string; objectType?: string; actor?: string; limit?: number } = {},
): Promise<AuditRow[]> {
  if (!canReadAudit(viewer.access)) throw new EditorialError("FORBIDDEN", "سجل التدقيق لصاحب عرض الجودة أو المعتمِد.");
  const params: unknown[] = [];
  const parts: string[] = [];
  if (filter.action?.trim()) {
    params.push(`${filter.action.trim().slice(0, 80)}%`);
    parts.push(`action LIKE $${params.length}`);
  }
  if (filter.objectType?.trim()) {
    params.push(filter.objectType.trim().slice(0, 40));
    parts.push(`object_type = $${params.length}`);
  }
  if (filter.actor?.trim()) {
    params.push(filter.actor.trim().slice(0, 120));
    parts.push(`actor_id = $${params.length}`);
  }
  params.push(Math.min(Math.max(filter.limit ?? 100, 1), 500));
  const where = parts.length ? `WHERE ${parts.join(" AND ")}` : "";
  return db.query<AuditRow>(
    `SELECT id::text AS id, actor_id, actor_kind, action, object_type, object_id, before_hash, after_hash, detail, at
       FROM audit_event ${where}
      ORDER BY at DESC, id DESC
      LIMIT $${params.length}`,
    params,
  );
}

export interface DeskCounts {
  draft: number;
  checksFailed: number;
  pending: number;
  approved: number;
  publishedToday: number;
  indexSyncPending: number;
  auditToday: number;
}

export async function deskCounts(db: SqlClient): Promise<DeskCounts | null> {
  try {
    const rows = await db.query<DeskCounts>(
      `SELECT
         (SELECT count(*)::int FROM change_set WHERE status = 'draft') AS "draft",
         (SELECT count(*)::int FROM change_set WHERE status = 'checks_failed') AS "checksFailed",
         (SELECT count(*)::int FROM change_set WHERE status = 'pending') AS "pending",
         (SELECT count(*)::int FROM change_set WHERE status = 'approved') AS "approved",
         (SELECT count(*)::int FROM change_set WHERE status = 'published'
             AND published_at >= date_trunc('day', NOW() AT TIME ZONE 'Asia/Riyadh') AT TIME ZONE 'Asia/Riyadh') AS "publishedToday",
         (SELECT count(*)::int FROM index_sync WHERE search_norm_at IS NULL OR opensearch_at IS NULL OR page_revalidated_at IS NULL) AS "indexSyncPending",
         (SELECT count(*)::int FROM audit_event
             WHERE at >= date_trunc('day', NOW() AT TIME ZONE 'Asia/Riyadh') AT TIME ZONE 'Asia/Riyadh') AS "auditToday"`,
    );
    return rows[0] ?? null;
  } catch {
    // جداول المكتب غير مطبّقة بعد على هذه القاعدة.
    return null;
  }
}

// ── عقد الواجهة (خطة التوحيد) ────────────────────────────────────────────────

/** null = المصدر غير متاح على هذه القاعدة (لا صفر). */
export interface IntakeCountsView {
  amendmentOpsUndecided: number | null;
  amendmentOpsBulkEligible: number | null;
  principlesNeedsReview: number | null;
  caseLinksNeedsReview: number | null;
  manualEffects: number | null;
  autoRelations: number | null;
}

export interface ChangeView {
  id: string;
  op: string;
  target_type: string;
  target_id: string;
  target_name: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  status: string;
  evidence_instrument: string | null;
  evidence_url: string | null;
  evidence_quote: string | null;
  checks: Record<string, unknown> | null;
  /** سطر عربي مقروء للتغيير (لا JSON). */
  summary: string;
}

export interface ChangeSetView {
  id: string;
  title: string;
  kind: string;
  status: string;
  author_kind: "human" | "agent";
  author_id: string | null;
  author_agent: string | null;
  created_at: string;
  approvals: number;
  required_approvals: number;
  my_decision: "approve" | "reject" | null;
  /** يملك المشاهد التراجع عنها الآن: منشورة، ليست قرار استقبال، بلا تراجع قائم، وكل هدف ما زال على ما نشرته، وفي نطاقه. */
  revertible: boolean;
  changes: ChangeView[];
}

const DECISION_LABEL: Record<string, string> = {
  approved: "موافقة",
  rejected: "رفض",
  approved_with_edit: "موافقة مع تصحيح",
};

const CORRECTION_LABEL: Record<string, string> = {
  article_number: "رقم المادة",
  paragraph_label: "الفقرة",
  effective_from_hijri: "تاريخ السريان الهجري",
  effective_from_gregorian: "تاريخ السريان الميلادي",
  new_text: "النص الجديد",
  op_type: "نوع العملية",
  old_phrase: "العبارة القديمة",
  new_phrase: "العبارة الجديدة",
  target_law_title: "النظام المستهدف",
};

const PRINCIPLE_LABEL: Record<string, string> = { reviewed: "اعتماد", rejected: "رفض", needs_review: "إعادة إلى المراجعة" };

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** سطر عربي للتغيير من صفه (دالة نقية). */
export function summarizeChange(
  setKind: string,
  change: { op: string; target_id: string; before: unknown; after: unknown },
  targetName: string | null,
): string {
  const before = asRecord(change.before);
  const after = asRecord(change.after);
  const name = targetName ?? change.target_id;
  if (change.op === "set_work_status") {
    const from = str(before?.status) ?? "بلا حالة موثّقة";
    const to = str(after?.status) ?? "—";
    const line = `حالة «${name}»: ${from} ← ${to}`;
    return setKind === "revert" || setKind === "emergency_revert" ? `تراجع — ${line}` : line;
  }
  if (change.op === "review_amendment_op") {
    const decision = str(after?.decision);
    const label = decision ? DECISION_LABEL[decision] ?? decision : "قرار غير محدد";
    const corrected = asRecord(after?.corrected);
    const fields = corrected ? Object.keys(corrected).map((k) => CORRECTION_LABEL[k] ?? k) : [];
    const detail = decision === "approved_with_edit" && fields.length ? ` (${fields.join("، ")})` : "";
    return `قرار عملية التعديل ${change.target_id} على «${targetName ?? "نظام غير محدد"}»: ${label}${detail}`;
  }
  if (change.op === "review_principle") {
    const status = str(after?.reviewStatus);
    return `مراجعة المبدأ «${name}»: ${status ? PRINCIPLE_LABEL[status] ?? status : "قرار غير محدد"}`;
  }
  return `تغيير «${change.op}» على ${name}`;
}

interface DetailedSetRow {
  id: string;
  title: string;
  kind: string;
  status: string;
  author_kind: "human" | "agent";
  author_id: string | null;
  author_agent: string | null;
  reverts_change_set_id: string | null;
  payload_hash: string | null;
  idempotency_key: string | null;
  created_at: Date;
  published_at: Date | null;
}

const OPEN_FILTER = ["draft", "checks_failed", "pending", "approved"];

/**
 * دفعات المكتب بتفاصيلها للواجهة. يرى المشاهد ما في نطاقه أو ما أعدّه؛ المالك يرى الكل.
 * status: «open» للمفتوحة، أو حالة بعينها، أو بلا قيمة للكل. الحد 200.
 */
export async function listChangeSetsDetailed(
  db: SqlClient,
  actor: EditorialActor,
  opts: { status?: string; limit?: number; id?: string } = {},
): Promise<ChangeSetView[]> {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const params: unknown[] = [limit];
  let where = "";
  if (opts.id) {
    params.push(opts.id);
    where = `WHERE s.id = $2`;
  } else if (opts.status === "open") where = `WHERE s.status = ANY('{${OPEN_FILTER.join(",")}}'::text[])`;
  else if (opts.status) {
    params.push(opts.status);
    where = `WHERE s.status = $2`;
  }
  const sets = await db.query<DetailedSetRow>(`SELECT s.* FROM change_set s ${where} ORDER BY s.created_at DESC LIMIT $1`, params);
  if (!sets.length) return [];
  const ids = sets.map((s) => s.id);
  const [changes, decisions, loaded] = await Promise.all([
    db.query<ChangeRowLike>(`SELECT * FROM editorial_change WHERE change_set_id = ANY($1::text[]) ORDER BY created_at, id`, [ids]),
    db.query<DecisionRowLike>(
      `SELECT d.id, d.change_set_id, d.reviewer_id, d.decision, d.reason, d.self_approval, d.payload_hash, d.decided_at,
              u.role::text AS role, u."isActive", u.name
         FROM review_decision d LEFT JOIN users u ON u.id = d.reviewer_id
        WHERE d.change_set_id = ANY($1::text[]) ORDER BY d.decided_at, d.id`,
      [ids],
    ),
    loadEditorialConfig(db).catch(() => ({ version: 0, config: DEFAULT_EDITORIAL_CONFIG, installed: false })),
  ]);
  const config = loaded.config;
  const names = await targetNames(db, changes);

  // أهلية التراجع: الحالة الحالية لكل هدف، والتراجعات القائمة.
  const workTargets = Array.from(new Set(changes.filter((c) => c.op === "set_work_status").map((c) => c.target_id)));
  const latest = new Map<string, string>();
  if (workTargets.length) {
    const rows = await db.query<{ object_id: string; id: string }>(
      `SELECT DISTINCT ON (object_id) object_id, id FROM verification
        WHERE object_type = 'work' AND object_id = ANY($1::text[]) ORDER BY object_id, verified_at DESC, id DESC`,
      [workTargets],
    );
    for (const r of rows) latest.set(r.object_id, r.id);
  }
  const reverted = new Set(
    (
      await db.query<{ reverts_change_set_id: string }>(
        `SELECT reverts_change_set_id FROM change_set WHERE reverts_change_set_id = ANY($1::text[]) AND status <> 'rejected'`,
        [ids],
      )
    ).map((r) => r.reverts_change_set_id),
  );
  const revertPolicyOn = config.policies.revert?.enabled !== false;

  const out: ChangeSetView[] = [];
  for (const set of sets) {
    const own = changes.filter((c) => c.change_set_id === set.id);
    const isAuthor =
      authoredBy(set, actor.id) ||
      (set.author_kind === "agent" && actor.kind === "agent" && set.author_agent === (actor.agentName ?? actor.id));
    const visible = actor.access.superAdmin || isAuthor || own.some((c) => inScope(actor.access, itemKindOf(set, c), c.domain));
    if (!visible) continue;
    const setDecisions = decisions.filter((d) => d.change_set_id === set.id);
    const state = approvalStateFrom(config, set as unknown as ChangeSetRow, own as unknown as ChangeRow[], setDecisions);
    const mine = setDecisions.find((d) => d.reviewer_id === actor.id);
    const revertible =
      set.status === "published" &&
      !isIntakeSet(set) &&
      own.length > 0 &&
      own.every((c) => c.op === "set_work_status" && c.applied_ref !== null && latest.get(c.target_id) === c.applied_ref) &&
      !reverted.has(set.id) &&
      (actor.access.superAdmin || (revertPolicyOn && own.every((c) => canRequestRevertIn(actor.access, c.domain))));
    out.push({
      id: set.id,
      title: set.title,
      kind: set.kind,
      status: set.status,
      author_kind: set.author_kind,
      author_id: set.author_id,
      author_agent: set.author_agent,
      created_at: new Date(set.created_at).toISOString(),
      approvals: state.approvals,
      required_approvals: state.required,
      my_decision: mine ? mine.decision : null,
      revertible,
      changes: own.map((c) => {
        const targetName = names.get(`${c.target_type}#${c.target_id}`) ?? null;
        const checks = asRecord(c.checks);
        return {
          id: c.id,
          op: c.op,
          target_type: c.target_type,
          target_id: c.target_id,
          target_name: targetName,
          before: asRecord(c.before),
          after: asRecord(c.after),
          status: c.status,
          evidence_instrument: c.evidence_instrument,
          evidence_url: c.evidence_url,
          evidence_quote: c.evidence_quote,
          checks: checks && Object.keys(checks).length ? checks : null,
          summary: summarizeChange(set.kind, c, targetName),
        };
      }),
    });
  }
  return out;
}

type ChangeRowLike = ChangeRow;
type DecisionRowLike = DecisionRow & { change_set_id: string };

/** أسماء الأهداف: الأنظمة من legal_systems، والمبادئ من judicial_principles، وعمليات التعديل باسم نظامها المستهدف. */
async function targetNames(db: SqlClient, changes: Array<{ target_type: string; target_id: string }>): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const of = (type: string) => Array.from(new Set(changes.filter((c) => c.target_type === type).map((c) => c.target_id)));
  const read = async (type: string, sql: string, ids: string[]) => {
    if (!ids.length) return;
    try {
      for (const r of await db.query<{ id: string; name: string | null }>(sql, [ids])) if (r.name) out.set(`${type}#${r.id}`, r.name);
    } catch {
      // المصدر غير متاح على هذه القاعدة: يبقى الاسم null.
    }
  };
  await read("work", `SELECT id, name FROM legal_systems WHERE id = ANY($1::text[])`, of("work"));
  await read("principle", `SELECT id, title AS name FROM judicial_principles WHERE id = ANY($1::text[])`, of("principle"));
  await read("amendment_op", `SELECT op_id AS id, target_law_title AS name FROM uqn_fix.amendment_op WHERE op_id = ANY($1::text[])`, of("amendment_op"));
  return out;
}

/** GET /api/admin/legal/systems/:id */
export async function getSystemSummary(db: SqlClient, id: string): Promise<{ id: string; name: string; domain: string | null } | null> {
  const rows = await db.query<{ id: string; name: string; domain: string | null }>(`SELECT id, name, domain FROM legal_systems WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

// W-07: اعتماد مقترحات الذكاء الاصطناعي القائمة من طابور المكتب.
// المصادر تُقرأ مباشرة (لا نسخ مسبق). القرار يُسجَّل في معاملة واحدة:
// change_set + editorial_change (مؤلفه الوكيل) + review_decision (المعتمِد البشري) + audit_event + صف قرار المصدر.
// عملية التعديل: صف جديد في uqn_fix.amendment_review (للإضافة فقط بمشغّل no_change)، ولا يُمس نص أي مادة.
// تعدد الموافقات (ق-٦): حين minApprovals > 1 يبقى المقترح «pending» حتى تكتمل موافقات القرار نفسه.
import { canReviewIn } from "./access";
import { recordAudit, sourceRankFromUrl, stableJson } from "./audit";
import {
  approvalState,
  approvalStateFrom,
  assertPayloadUnchanged,
  auditDenied,
  changesOf,
  decisionsOf,
  insertDecision,
  lockChangeSet,
  newId,
  sealPayload,
  setStatus,
  type ChangeRow,
  type ChangeSetRow,
} from "./core";
import { pgErrorCode, type EditorialDb, type SqlClient } from "./db";
import { decodeCursor, encodeCursor } from "./cursor";
import { deskTransaction, type DeskContext } from "./desk-tx";
import { hijriToGregorian, parseHijri } from "./hijri";
import { applyIntakeSet, lockPrinciple, lockUndecidedOp, opSourceRef, principleSourceRef, type OpRow } from "./intake-apply";
import { assertDeskIntegrity } from "./integrity";
import { loadEditorialConfig, policyFor, policySnapshot, type EditorialConfig } from "./policy";
import type { IntakeCountsView } from "./read";
import { EditorialError, type AmendmentDecision, type EditorialActor, type ItemKind, type PrincipleDecision } from "./types";
import { assertEditorialWriteEnabled } from "./write-gate";
import { principleStatusFor } from "@/lib/modules/legal-core/principle-review";
import { citationFlagsFromVerification, textAsOf, type UnitVersionRecord } from "@/lib/modules/legal-core/verified-status";

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
  /** النص الساري الآن للمادة المستهدفة إن أمكن حلّه من legal_articles/unit_version؛ وإلا null. */
  current_text: string | null;
  current_text_resolved: boolean;
  /** تعدد الموافقات: الموافقات الصالحة على المقترح المعلّق (0 إن لم يكن)، والحد الأدنى، وهل وافق المشاهد. */
  pending_approvals: number;
  required_approvals: number;
  my_approval: boolean;
  /** دفعة المقترح المعلّق (إضافة على العقد لتمكين الرفض/السحب من الواجهة). */
  pending_change_set_id: string | null;
  /** القرار المعروض للموافقة: { decision: "approved" | "rejected" | "approved_with_edit" }. */
  pending_decision: PendingAmendmentDecision | null;
  /** ملحق الجولة الثانية (م١، ق٢٣): حمولة التصحيح، وملاحظة صاحب المقترح، وبصمة القرار، وأصحاب الموافقات. */
  pending_corrected: Record<string, string | number> | null;
  pending_note: string | null;
  pending_decision_hash: string | null;
  pending_approvers: PendingApprover[];
}

export interface PendingApprover {
  id: string;
  name: string | null;
  at: string;
}

export interface PendingAmendmentDecision {
  decision: AmendmentDecision;
}

export interface PendingPrincipleDecision {
  decision: PrincipleDecision;
}

/** اسم العقد في خطة التوحيد. */
export type AmendmentItem = AmendmentQueueItem;

/** «mine» (الافتراضي): ما ينتظر قرار المشاهد. «waiting_others»: ما وافق عليه وينتظر موافقات أخرى (ق٣٢). */
export type QueueView = "mine" | "waiting_others";

export interface QueuePage<T> {
  items: T[];
  /** عدد العرض المختار بمرشحاته. */
  total: number;
  /** مؤشر الصفحة التالية (بعد آخر مفتاح ترتيب)، أو null إن لم يبقَ شيء. */
  next_cursor: string | null;
  /** عدد ما وافق عليه المشاهد وينتظر غيره، بالمرشحات نفسها. */
  waiting_others: number;
}

export interface AmendmentQueueFilter {
  confidence?: "rule_exact" | "needs_review";
  opType?: string;
  target?: string;
  bulkOnly?: boolean;
  limit?: number;
  /** الترقيم بالمفتاح (ق٢٦): مؤشر next_cursor من الصفحة السابقة. يُقدَّم على offset. */
  after?: string | null;
  /** @deprecated الترقيم بالإزاحة يتخطى عناصر بعد قرارات محلية؛ يبقى مقبولًا للتوافق حين لا يُرسل after. */
  offset?: number;
  view?: QueueView;
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

type AmendmentBaseRow = Omit<
  AmendmentQueueItem,
  | "current_text"
  | "current_text_resolved"
  | "pending_approvals"
  | "required_approvals"
  | "my_approval"
  | "pending_change_set_id"
  | "pending_decision"
  | "pending_corrected"
  | "pending_note"
  | "pending_decision_hash"
  | "pending_approvers"
> & { k_priority: number };

/** موافقة المشاهد قائمة على المقترح المعلّق لهذا المصدر (على بصمة الدفعة الحالية). */
function myPendingApprovalSql(sourceRefExpr: string, viewerParam: string): string {
  return `EXISTS (SELECT 1 FROM editorial_change pc
                    JOIN change_set ps ON ps.id = pc.change_set_id AND ps.status = 'pending'
                    JOIN review_decision pd ON pd.change_set_id = ps.id AND pd.decision = 'approve' AND pd.payload_hash = ps.payload_hash
                   WHERE pc.source_ref = ${sourceRefExpr} AND pc.status = 'pending' AND pd.reviewer_id = ${viewerParam})`;
}

/** يضيف شرط العرض: mine يستبعد ما وافق عليه المشاهد وينتظر غيره، وwaiting_others يقصره عليه. */
function viewCondition(view: QueueView, sourceRefExpr: string, viewerId: string | null, params: unknown[]): string | null {
  if (!viewerId) return view === "waiting_others" ? "FALSE" : null;
  params.push(viewerId);
  const mine = myPendingApprovalSql(sourceRefExpr, `$${params.length}`);
  return view === "waiting_others" ? mine : `NOT ${mine}`;
}

const OP_SOURCE_REF_SQL = `('uqn_fix.amendment_op:' || o.op_id)`;
// ترتيب الطابور كما كان (rule_exact حرفي محلول أولًا، ثم النظام، ثم المادة NULLS LAST، ثم المعرّف)،
// مكتوبًا بمفاتيح تصاعدية كلها ليصلح للمقارنة الصفّية في الترقيم بالمفتاح.
const OP_PRIORITY_SQL = `(CASE WHEN (o.confidence = 'rule_exact' AND o.verbatim_in_source IS TRUE AND o.target_hakeem_code IS NOT NULL) THEN 0 ELSE 1 END)`;
const OP_ORDER_SQL = `${OP_PRIORITY_SQL}, o.target_law_title, (o.article_number IS NULL), coalesce(o.article_number, 0), o.op_id`;
const OP_CURSOR_SHAPE = ["integer", "string", "boolean", "integer", "string"] as const;

function queueView(raw: unknown): QueueView {
  return raw === "waiting_others" ? "waiting_others" : "mine";
}

export async function listAmendmentQueue(
  db: SqlClient,
  filter: AmendmentQueueFilter = {},
  viewer?: Pick<EditorialActor, "id"> | null,
): Promise<QueuePage<AmendmentQueueItem>> {
  const limit = Math.min(Math.max(filter.limit ?? 25, 1), 100);
  const view = queueView(filter.view);
  const viewerId = viewer?.id ?? null;
  const where = amendmentWhere(filter);
  const baseParams = [...where.params];
  const viewSql = viewCondition(view, OP_SOURCE_REF_SQL, viewerId, baseParams);
  const baseWhere = viewSql ? `${where.sql} AND ${viewSql}` : where.sql;

  const totalRows = await db.query<{ total: number }>(`SELECT count(*)::int AS total FROM uqn_fix.amendment_op o WHERE ${baseWhere}`, baseParams);
  let waitingOthers = 0;
  if (viewerId) {
    const wParams = [...where.params];
    const wSql = viewCondition("waiting_others", OP_SOURCE_REF_SQL, viewerId, wParams);
    waitingOthers = Number(
      (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM uqn_fix.amendment_op o WHERE ${where.sql} AND ${wSql}`, wParams))[0]?.n ?? 0,
    );
  }

  const params = [...baseParams];
  let pageSql = baseWhere;
  let offset = 0;
  if (filter.after) {
    const key = decodeCursor(filter.after, OP_CURSOR_SHAPE);
    params.push(key[0], key[1], key[2], key[3], key[4]);
    const n = params.length;
    pageSql += ` AND (${OP_PRIORITY_SQL}, o.target_law_title, (o.article_number IS NULL), coalesce(o.article_number, 0), o.op_id)
                    > ($${n - 4}::int, $${n - 3}::text, $${n - 2}::boolean, $${n - 1}::int, $${n}::text)`;
  } else {
    offset = Math.max(filter.offset ?? 0, 0);
  }
  params.push(limit + 1, offset);
  const fetched = await db.query<AmendmentBaseRow>(
    `SELECT o.op_id, o.effect_id, o.instrument_kind, o.instrument_no, o.instrument_date_hijri, o.published_hijri,
            o.source_url, o.target_law_title, o.target_hakeem_code, o.target_resolution, e.target_match_status,
            o.op_type, o.article_number, o.paragraph_label, o.term, o.new_text, o.old_phrase, o.new_phrase,
            o.effective_from_hijri, o.effective_from_gregorian::text AS effective_from_gregorian, o.effective_rule,
            o.risks, o.confidence, o.verbatim_in_source, o.evidence_quote,
            ${BULK_ELIGIBLE_SQL} AS bulk_eligible,
            ${OP_PRIORITY_SQL} AS k_priority
       FROM uqn_fix.amendment_op o
       LEFT JOIN uqn_stage.effect e ON e.effect_id = o.effect_id
      WHERE ${pageSql}
      ORDER BY ${OP_ORDER_SQL}
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  const hasMore = fetched.length > limit;
  const rows = hasMore ? fetched.slice(0, limit) : fetched;
  const last = rows[rows.length - 1];
  const nextCursor =
    hasMore && last
      ? encodeCursor([Number(last.k_priority), last.target_law_title, last.article_number === null, Number(last.article_number ?? 0), last.op_id])
      : null;

  const [texts, pending] = await Promise.all([
    resolveCurrentTexts(db, rows),
    pendingInfo(db, rows.map((r) => opSourceRef(r.op_id)), "review_amendment_op", viewerId),
  ]);
  const items: AmendmentQueueItem[] = rows.map(({ k_priority: _k, ...row }) => {
    void _k;
    const text = texts.get(row.op_id) ?? null;
    const p = pending.bySourceRef.get(opSourceRef(row.op_id));
    const after = p?.after ?? null;
    const decision = after && typeof after.decision === "string" ? (after.decision as AmendmentDecision) : null;
    const corrected = after?.corrected && typeof after.corrected === "object" ? (after.corrected as Record<string, string | number>) : null;
    return {
      ...row,
      current_text: text,
      current_text_resolved: text !== null,
      pending_approvals: p?.approvals ?? 0,
      required_approvals: pending.required,
      my_approval: p?.mine ?? false,
      pending_change_set_id: p?.changeSetId ?? null,
      pending_decision: decision ? { decision } : null,
      pending_corrected: corrected,
      pending_note: p?.note ?? null,
      pending_decision_hash: p?.hash ?? null,
      pending_approvers: p?.approvers ?? [],
    };
  });
  return { items, total: totalRows[0]?.total ?? 0, next_cursor: nextCursor, waiting_others: waitingOthers };
}

// ── النص الساري للمادة المستهدفة ──────────────────────────────────────────────

/** عمليات لا هدف لها مادة قائمة: نص ساري لا معنى له هنا. */
const NON_ARTICLE_OPS = new Set(["insert_article", "replace_law", "repeal_law", "rename_law"]);

/**
 * النص الساري الآن للمادة المستهدفة: آخر نسخة في unit_version سارية اليوم وإلا legal_articles.content،
 * والمادة الملغاة (آخر سجل تحقق للوحدة) سطر إلغائها. لا يُخمَّن: نظام غير محلول، أو مادة غير موجودة،
 * أو أكثر من مادة بالرقم نفسه = null (current_text_resolved=false). تعذّر القراءة = null.
 */
export async function resolveCurrentTexts(
  db: SqlClient,
  rows: Array<Pick<AmendmentQueueItem, "op_id" | "op_type" | "article_number" | "target_hakeem_code">>,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const wanted = rows.filter((r) => r.article_number !== null && r.target_hakeem_code && !NON_ARTICLE_OPS.has(r.op_type));
  if (!wanted.length) return out;
  try {
    const codes = Array.from(new Set(wanted.map((r) => String(r.target_hakeem_code))));
    const systems = await db.query<{ id: string; code: string | null }>(
      `SELECT id, code FROM legal_systems WHERE code = ANY($1::text[]) OR id = ANY($1::text[])`,
      [codes],
    );
    const systemOf = new Map<string, string>();
    for (const code of codes) {
      const byCode = systems.filter((s) => s.code === code);
      const byId = systems.filter((s) => s.id === code);
      const pick = byCode.length === 1 ? byCode[0] : byCode.length === 0 && byId.length === 1 ? byId[0] : null;
      if (pick) systemOf.set(code, pick.id);
    }
    const systemIds = Array.from(new Set(systemOf.values()));
    if (!systemIds.length) return out;
    const numbers = Array.from(new Set(wanted.map((r) => String(r.article_number))));
    const articles = await db.query<{ id: string; system_id: string; number: string; content: string }>(
      `SELECT id, "legalSystemId" AS system_id, "articleNumber"::text AS number, content
         FROM legal_articles WHERE "legalSystemId" = ANY($1::text[]) AND "articleNumber"::text = ANY($2::text[])`,
      [systemIds, numbers],
    );
    const articleOf = new Map<string, { id: string; content: string } | null>();
    for (const a of articles) {
      const key = `${a.system_id}#${a.number}`;
      articleOf.set(key, articleOf.has(key) ? null : { id: a.id, content: a.content });
    }
    const unitIds = Array.from(articleOf.values()).filter((a): a is { id: string; content: string } => a !== null).map((a) => a.id);
    const versions = new Map<string, UnitVersionRecord[]>();
    const repealLine = new Map<string, string>();
    if (unitIds.length) {
      const vrows = await db.query<{ id: string; unit_id: string; body: string; valid_from: Date; evidence_instrument: string | null; evidence_url: string | null }>(
        `SELECT id, unit_id, body, valid_from, evidence_instrument, evidence_url FROM unit_version WHERE unit_id = ANY($1::text[]) ORDER BY unit_id, valid_from`,
        [unitIds],
      );
      for (const v of vrows) {
        const list = versions.get(v.unit_id) ?? [];
        list.push({ id: v.id, body: v.body, validFrom: new Date(v.valid_from).toISOString(), evidenceInstrument: v.evidence_instrument, evidenceUrl: v.evidence_url });
        versions.set(v.unit_id, list);
      }
      const ver = await db.query<{ object_id: string; id: string; verified_status: string; evidence_instrument: string | null; evidence_url: string | null; evidence_quote: string | null; verified_at: Date }>(
        `SELECT DISTINCT ON (object_id) object_id, id, verified_status, evidence_instrument, evidence_url, evidence_quote, verified_at
           FROM verification WHERE object_type = 'unit' AND object_id = ANY($1::text[])
          ORDER BY object_id, verified_at DESC, id DESC`,
        [unitIds],
      );
      for (const v of ver) {
        const flags = citationFlagsFromVerification({
          id: v.id,
          verifiedStatus: v.verified_status,
          evidenceInstrument: v.evidence_instrument,
          evidenceUrl: v.evidence_url,
          evidenceQuote: v.evidence_quote,
          verifiedAt: new Date(v.verified_at).toISOString(),
        });
        if (flags.repealed) {
          const instrument = v.evidence_instrument?.trim();
          repealLine.set(v.object_id, instrument ? `أُلغيت هذه المادة بموجب ${instrument}` : "أُلغيت هذه المادة");
        }
      }
    }
    const now = new Date();
    for (const row of wanted) {
      const systemId = systemOf.get(String(row.target_hakeem_code));
      if (!systemId) continue;
      const article = articleOf.get(`${systemId}#${row.article_number}`);
      if (!article) continue;
      out.set(row.op_id, repealLine.get(article.id) ?? textAsOf(article.content, versions.get(article.id) ?? [], now).text);
    }
  } catch {
    // جداول النصوص غير مطبّقة على هذه القاعدة: لا نص، لا خطأ.
    return new Map();
  }
  return out;
}

// ── معلومات المقترحات المعلّقة ───────────────────────────────────────────────

interface PendingInfo {
  changeSetId: string;
  approvals: number;
  mine: boolean;
  after: Record<string, unknown> | null;
  /** بصمة القرار المعروض = بصمة حمولة دفعة المقترح. */
  hash: string | null;
  /** ملاحظة صاحب المقترح (سبب أول موافقة). */
  note: string | null;
  approvers: PendingApprover[];
}

/** الموافقات الصالحة الآن (بصلاحية المعتمِدين الحالية) على المقترحات المعلّقة لهذه المصادر، ومضمون القرار المعروض. */
async function pendingInfo(
  db: SqlClient,
  sourceRefs: string[],
  kind: ItemKind,
  viewerId: string | null,
): Promise<{ required: number; bySourceRef: Map<string, PendingInfo> }> {
  const bySourceRef = new Map<string, PendingInfo>();
  let config: EditorialConfig;
  try {
    config = (await loadEditorialConfig(db)).config;
  } catch {
    return { required: 1, bySourceRef };
  }
  const required = policySnapshot(config, kind).minApprovals;
  if (!sourceRefs.length) return { required, bySourceRef };
  try {
    const changes = await db.query<ChangeRow>(
      `SELECT * FROM editorial_change WHERE source_ref = ANY($1::text[]) AND status = 'pending'`,
      [sourceRefs],
    );
    for (const change of changes) {
      const sets = await db.query<ChangeSetRow>(`SELECT * FROM change_set WHERE id = $1`, [change.change_set_id]);
      if (!sets[0] || sets[0].status !== "pending") continue;
      const all = await changesOf(db, sets[0].id);
      const decisions = await decisionsOf(db, sets[0].id);
      const state = approvalStateFrom(config, sets[0], all, decisions);
      const approves = decisions.filter((d) => d.decision === "approve" && d.payload_hash === sets[0].payload_hash);
      bySourceRef.set(change.source_ref as string, {
        changeSetId: sets[0].id,
        approvals: state.approvals,
        mine: viewerId !== null && approves.some((d) => d.reviewer_id === viewerId),
        after: (change.after as unknown as Record<string, unknown>) ?? null,
        hash: sets[0].payload_hash,
        note: approves[0]?.reason ?? null,
        approvers: state.approvers.map((id) => {
          const d = approves.find((x) => x.reviewer_id === id);
          return { id, name: d?.name ?? null, at: d ? new Date(d.decided_at).toISOString() : "" };
        }),
      });
    }
  } catch {
    // جداول المكتب غير مطبّقة: لا مقترحات معلّقة.
  }
  return { required, bySourceRef };
}

export interface PrincipleQueueItem {
  id: string;
  title: string;
  principleText: string;
  sourceCaseId: string;
  /** معرّف الحكم مصدر المبدأ (اسم العقد). */
  source_case_id: string;
  court: string | null;
  topic: string | null;
  confidence: number | null;
  pending_approvals: number;
  required_approvals: number;
  my_approval: boolean;
  pending_change_set_id: string | null;
  /** القرار المعروض للموافقة: { decision: "approve" | "reject" }. */
  pending_decision: PendingPrincipleDecision | null;
  /** لا تصحيح في المبدأ؛ null دائمًا (للتماثل مع عنصر التعديل). */
  pending_corrected: Record<string, string | number> | null;
  pending_note: string | null;
  pending_decision_hash: string | null;
  pending_approvers: PendingApprover[];
}

/** اسم العقد في خطة التوحيد. */
export type PrincipleItem = PrincipleQueueItem;

type PrincipleBaseRow = Pick<PrincipleQueueItem, "id" | "title" | "principleText" | "sourceCaseId" | "court" | "topic" | "confidence"> & {
  round: string;
};

export interface PrincipleQueueFilter {
  topic?: string;
  limit?: number;
  after?: string | null;
  /** @deprecated يبقى مقبولًا للتوافق حين لا يُرسل after. */
  offset?: number;
  view?: QueueView;
}

const PRINCIPLE_SOURCE_REF_SQL = `('judicial_principles:' || p.id || ':' || to_char(p."updatedAt", 'YYYYMMDD"T"HH24MISS.US'))`;
// الترتيب كما كان: الثقة تنازليًّا NULLS LAST ثم المعرّف، بمفاتيح تصاعدية للمقارنة الصفّية.
const PRINCIPLE_ORDER_SQL = `(p.confidence IS NULL), -coalesce(p.confidence, 0), p.id`;
const PRINCIPLE_CURSOR_SHAPE = ["boolean", "number", "string"] as const;

export async function listPrincipleQueue(
  db: SqlClient,
  filter: PrincipleQueueFilter = {},
  viewer?: Pick<EditorialActor, "id"> | null,
): Promise<QueuePage<PrincipleQueueItem>> {
  const limit = Math.min(Math.max(filter.limit ?? 25, 1), 100);
  const view = queueView(filter.view);
  const viewerId = viewer?.id ?? null;
  const filterParams: unknown[] = [];
  let topicSql = "";
  if (filter.topic && filter.topic.trim()) {
    filterParams.push(`%${filter.topic.trim().slice(0, 100)}%`);
    topicSql = ` AND (p.topic ILIKE $1 OR p.title ILIKE $1)`;
  }
  const filterWhere = `p."reviewStatus" = 'needs_review'${topicSql}`;
  const baseParams = [...filterParams];
  const viewSql = viewCondition(view, PRINCIPLE_SOURCE_REF_SQL, viewerId, baseParams);
  const baseWhere = viewSql ? `${filterWhere} AND ${viewSql}` : filterWhere;
  const totalRows = await db.query<{ total: number }>(`SELECT count(*)::int AS total FROM judicial_principles p WHERE ${baseWhere}`, baseParams);
  let waitingOthers = 0;
  if (viewerId) {
    const wParams = [...filterParams];
    const wSql = viewCondition("waiting_others", PRINCIPLE_SOURCE_REF_SQL, viewerId, wParams);
    waitingOthers = Number(
      (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM judicial_principles p WHERE ${filterWhere} AND ${wSql}`, wParams))[0]?.n ?? 0,
    );
  }
  const params = [...baseParams];
  let pageSql = baseWhere;
  let offset = 0;
  if (filter.after) {
    const key = decodeCursor(filter.after, PRINCIPLE_CURSOR_SHAPE);
    params.push(key[0], key[1], key[2]);
    const n = params.length;
    pageSql += ` AND (${PRINCIPLE_ORDER_SQL}) > ($${n - 2}::boolean, $${n - 1}::double precision, $${n}::text)`;
  } else {
    offset = Math.max(filter.offset ?? 0, 0);
  }
  params.push(limit + 1, offset);
  const fetched = await db.query<PrincipleBaseRow>(
    `SELECT p.id, p.title, p."principleText", p."sourceCaseId", p.court, p.topic, p.confidence,
            to_char(p."updatedAt", 'YYYYMMDD"T"HH24MISS.US') AS round
       FROM judicial_principles p
      WHERE ${pageSql}
      ORDER BY ${PRINCIPLE_ORDER_SQL}
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  const hasMore = fetched.length > limit;
  const rows = hasMore ? fetched.slice(0, limit) : fetched;
  const last = rows[rows.length - 1];
  const nextCursor =
    hasMore && last ? encodeCursor([last.confidence === null, last.confidence === null ? 0 : -Number(last.confidence), last.id]) : null;
  const pending = await pendingInfo(db, rows.map((r) => principleSourceRef(r.id, r.round)), "review_principle", viewerId);
  const items: PrincipleQueueItem[] = rows.map(({ round, ...row }) => {
    const p = pending.bySourceRef.get(principleSourceRef(row.id, round));
    const status = typeof p?.after?.reviewStatus === "string" ? p.after.reviewStatus : null;
    return {
      ...row,
      source_case_id: row.sourceCaseId,
      pending_approvals: p?.approvals ?? 0,
      required_approvals: pending.required,
      my_approval: p?.mine ?? false,
      pending_change_set_id: p?.changeSetId ?? null,
      pending_decision: status ? { decision: status === "reviewed" ? "approve" : "reject" } : null,
      pending_corrected: null,
      pending_note: p?.note ?? null,
      pending_decision_hash: p?.hash ?? null,
      pending_approvers: p?.approvers ?? [],
    };
  });
  return { items, total: totalRows[0]?.total ?? 0, next_cursor: nextCursor, waiting_others: waitingOthers };
}

/** @deprecated الاسم القديم؛ العقد IntakeCountsView في read.ts (null للمصدر غير المتاح). */
export type IntakeCounts = IntakeCountsView;

/** عدّادات المصادر للوحة. المصدر غير المتاح على هذه القاعدة = null (لا صفر) ويُسمّى في unavailable. */
export async function intakeCounts(db: SqlClient): Promise<IntakeCountsView & { unavailable: string[] }> {
  const unavailable: string[] = [];
  const count = async (label: string, sql: string): Promise<number | null> => {
    try {
      const rows = await db.query<{ n: number }>(sql);
      return Number(rows[0]?.n ?? 0);
    } catch {
      unavailable.push(label);
      return null;
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
// ملحق الجولة الثانية (ق٢٣-٣): من يقرّر على عنصر عليه مقترح معلّق يرسل بصمة القرار المعروض (expectedDecisionHash)؛
// غيابها أو اختلافها 409 بلا كتابة، والموافقة الثانية لا تغيّر القرار ولا التصحيح.

export interface IntakeDecisionResult {
  changeSetId: string;
  status: "pending" | "published" | "rejected";
  approvals: number;
  requiredApprovals: number;
  /** بصمة القرار (بصمة حمولة دفعة المقترح)، لترسلها الموافقة التالية. */
  decisionHash: string | null;
}

export const DISPLAYED_DECISION_CHANGED = "تغيّر القرار المعروض؛ راجعه.";

/** حكم قرار المعتمِد على المقترح المعلّق: موافقة عليه، أو رفض له، أو تعارض. */
type PendingVerdict = "same" | "reject" | "conflict";

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
    return { changeSetId: set.id, status: "published", approvals: state.approvals, requiredApprovals: state.required, decisionHash: hash };
  }
  await recordAudit(tx, actor, {
    action: "intake.proposal.approve",
    objectType: "change_set",
    objectId: set.id,
    detail: { approvals: state.approvals, required: state.required, reason },
  });
  return { changeSetId: set.id, status: "pending", approvals: state.approvals, requiredApprovals: state.required, decisionHash: hash };
}

/**
 * يقرّر عنصر استقبال: ينضم إلى مقترح معلّق، أو يرفضه، أو يفتح مقترحًا جديدًا.
 * كل رفض هنا (بصمة غائبة أو مختلفة، أو قرار مختلف) يقع قبل أي كتابة، فالمعاملة تُلغى بلا أثر.
 */
async function decideIntakeItem(
  ctx: DeskContext,
  item: {
    sourceRef: string;
    expectedHash: string | null;
    reason: string | null;
    /** يقارن قرار المعتمِد بقرار المقترح المعلّق. */
    compare: (pendingAfter: Record<string, unknown>) => PendingVerdict;
    /** القرار الذي يُفتح به مقترح جديد؛ يرمي إن نقص ما يلزم لفتحه (التصحيح أو سبب الرفض). */
    openAfter: () => Record<string, unknown>;
    open: (after: Record<string, unknown>) => Promise<ChangeSetRow>;
  },
): Promise<IntakeDecisionResult> {
  const { tx, actor, config } = ctx;
  const pending = await pendingProposal(tx, item.sourceRef);
  const shown = pending?.set.payload_hash ?? null;
  if (item.expectedHash !== null) {
    // القرار المعروض اختفى (سُحب أو رُفض) أو تغيّر: لا موافقة على ما لم يره المعتمِد.
    if (!pending || shown !== item.expectedHash) {
      throw new EditorialError("CONFLICT", DISPLAYED_DECISION_CHANGED, {
        openChangeSetId: pending?.set.id ?? null,
        currentDecisionHash: shown,
        expectedDecisionHash: item.expectedHash,
      });
    }
  } else if (pending) {
    // رسالة للمستخدم بلا أسماء حقول داخلية (ن١): الطلب لم يحمل بصمة قرار معروض، أي أن الطابور قديم.
    throw new EditorialError("CONFLICT", "سجّل معتمِد آخر قرارًا على هذا العنصر قبل قليل؛ حدّث الطابور لترى القرار المعروض ثم قرّر.", {
      openChangeSetId: pending.set.id,
      currentDecisionHash: shown,
      pendingDecision: pending.change.after,
    });
  }
  if (pending) {
    const pendingAfter = (pending.change.after as unknown as Record<string, unknown>) ?? {};
    const verdict = item.compare(pendingAfter);
    if (verdict === "same") return approveProposal(ctx, pending.set, item.reason);
    if (verdict === "reject") {
      if (!item.reason) throw new EditorialError("REASON_REQUIRED", "رفض القرار المعلّق يحتاج سببًا مكتوبًا؛ يرفض القرار كله.");
      // رفض أي معتمِد يرفض المقترح المعلّق؛ العنصر يعود إلى الطابور بلا قرار في المصدر.
      const changes = await changesOf(tx, pending.set.id);
      const hash = assertPayloadUnchanged(pending.set, changes);
      await insertDecision(tx, { changeSetId: pending.set.id, reviewerId: actor.id, decision: "reject", reason: item.reason, selfApproval: false, payloadHash: hash });
      await setStatus(tx, pending.set.id, "rejected");
      await recordAudit(tx, actor, {
        action: "intake.proposal.reject",
        objectType: "change_set",
        objectId: pending.set.id,
        detail: { reason: item.reason, pending: pendingAfter },
      });
      const state = await approvalState(tx, config, pending.set, changes);
      return { changeSetId: pending.set.id, status: "rejected", approvals: state.approvals, requiredApprovals: state.required, decisionHash: hash };
    }
    throw new EditorialError("CONFLICT", "الموافقة الثانية على القرار المعروض نفسه فقط؛ لا تغيّر القرار ولا التصحيح. للرفض استعمل «رفض».", {
      openChangeSetId: pending.set.id,
      currentDecisionHash: shown,
      pendingDecision: pendingAfter,
    });
  }
  const after = item.openAfter();
  const set = await item.open(after);
  const changes = await changesOf(tx, set.id);
  const hash = await sealPayload(tx, set, changes);
  await insertDecision(tx, { changeSetId: set.id, reviewerId: actor.id, decision: "approve", reason: item.reason, selfApproval: false, payloadHash: hash });
  const state = await approvalState(tx, config, set, changes);
  if (state.complete) {
    await applyIntakeSet(tx, actor, set, changes, state);
    return { changeSetId: set.id, status: "published", approvals: state.approvals, requiredApprovals: state.required, decisionHash: hash };
  }
  await setStatus(tx, set.id, "pending");
  await recordAudit(tx, actor, {
    action: "intake.proposal.open",
    objectType: "change_set",
    objectId: set.id,
    detail: { sourceRef: item.sourceRef, after, approvals: state.approvals, required: state.required },
  });
  return { changeSetId: set.id, status: "pending", approvals: state.approvals, requiredApprovals: state.required, decisionHash: hash };
}

function cleanHash(value: unknown): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/.test(value)) throw new EditorialError("INVALID_INPUT", "بصمة القرار غير صالحة.");
  return value;
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
  input: { decision: AmendmentDecision; corrected?: unknown; note?: unknown; expectedDecisionHash?: unknown },
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
    const expectedHash = cleanHash(input.expectedDecisionHash);
    const hasCorrection =
      input.corrected !== undefined && input.corrected !== null && !(typeof input.corrected === "object" && !Object.keys(input.corrected as object).length);
    // بلا بصمة = فتح مقترح جديد: يلزم ما يلزم لفتحه. ومع البصمة يُحكم على المقترح المعروض داخل المعاملة.
    if (!expectedHash && decision === "rejected" && !note) throw new EditorialError("REASON_REQUIRED", "الرفض يحتاج سببًا مكتوبًا.");
    const corrected = hasCorrection || (decision === "approved_with_edit" && !expectedHash) ? validateCorrection(input.corrected) : null;
    if (corrected && decision !== "approved_with_edit") throw new EditorialError("INVALID_INPUT", "الحقول المصححة لا تُرسل إلا مع «موافق مع تصحيح».");
    const id = typeof opId === "string" ? opId.trim() : "";
    if (!id) throw new EditorialError("INVALID_INPUT", "معرّف العملية مطلوب.");

    return await deskTransaction(db, actor, async (ctx) => {
      assertReviewer(ctx.actor, "review_amendment_op");
      policyFor(ctx.config, "review_amendment_op");
      const op = await lockUndecidedOp(ctx.tx, id);
      const result = await decideIntakeItem(ctx, {
        sourceRef: opSourceRef(op.op_id),
        expectedHash,
        reason: note,
        compare: (pendingAfter) => {
          if (pendingAfter.decision === decision) {
            // الموافقة الثانية لا تغيّر التصحيح: إن أُرسل تصحيح فيجب أن يطابق المعروض.
            if (corrected && stableJson(corrected) !== stableJson(pendingAfter.corrected ?? null)) return "conflict";
            return "same";
          }
          return decision === "rejected" ? "reject" : "conflict";
        },
        // بصمة القرار: القرار والتصحيح وحدهما (الملاحظة سبب المعتمِد في صف قراره).
        openAfter: () => {
          if (decision === "rejected" && !note) throw new EditorialError("REASON_REQUIRED", "الرفض يحتاج سببًا مكتوبًا.");
          if (decision === "approved_with_edit" && !corrected) validateCorrection(input.corrected);
          return { decision, corrected: decision === "approved_with_edit" ? corrected : null };
        },
        open: async (after) => {
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
        return { changeSetId: set.id, status: "published" as const, approvals: state.approvals, requiredApprovals: state.required, decisionHash: hash, approved: ops.length };
      }
      // تعدد الموافقات: تكمله موافقات المعتمِدين الآخرين على الدفعة نفسها (decide في مسار الدفعات).
      await setStatus(tx, set.id, "pending");
      await recordAudit(tx, ctx.actor, {
        action: "intake.proposal.open",
        objectType: "change_set",
        objectId: set.id,
        detail: { bulk: true, ops: ops.length, approvals: state.approvals, required: state.required },
      });
      return { changeSetId: set.id, status: "pending" as const, approvals: state.approvals, requiredApprovals: state.required, decisionHash: hash, approved: 0 };
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
  input: { decision: PrincipleDecision; reason?: unknown; expectedDecisionHash?: unknown },
): Promise<IntakeDecisionResult & { reviewStatus: string }> {
  assertEditorialWriteEnabled();
  await assertDeskIntegrity(db);
  try {
    assertNotAgent(actor);
    if (input?.decision !== "approve" && input?.decision !== "reject") {
      throw new EditorialError("INVALID_INPUT", "القرار: approve أو reject.");
    }
    const reason = cleanNote(input.reason);
    const expectedHash = cleanHash(input.expectedDecisionHash);
    if (!expectedHash && input.decision === "reject" && !reason) throw new EditorialError("REASON_REQUIRED", "الرفض يحتاج سببًا مكتوبًا.");
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
        expectedHash,
        reason,
        compare: (pendingAfter) => (pendingAfter.reviewStatus === reviewStatus ? "same" : reviewStatus === "rejected" ? "reject" : "conflict"),
        openAfter: () => {
          if (reviewStatus === "rejected" && !reason) throw new EditorialError("REASON_REQUIRED", "الرفض يحتاج سببًا مكتوبًا.");
          return after;
        },
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

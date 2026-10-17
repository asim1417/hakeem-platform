// قراءات اللوحة: سجل التدقيق وعدّادات الطوابير.
import type { SqlClient } from "./db";

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

export async function listAudit(
  db: SqlClient,
  filter: { action?: string; objectType?: string; actor?: string; limit?: number } = {},
): Promise<AuditRow[]> {
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

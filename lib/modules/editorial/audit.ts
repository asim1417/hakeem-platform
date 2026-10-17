// سجل التدقيق التحريري (audit_event): إضافة فقط، والقاعدة ترفض التعديل والحذف بمشغّل.
import { createHash } from "node:crypto";
import type { SqlClient } from "./db";
import type { EditorialActor } from "./types";

/** JSON ثابت الترتيب حتى تكون البصمة واحدة للقيمة نفسها. */
export function stableJson(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableJson(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function fingerprint(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

export interface AuditInput {
  action: string;
  objectType: string;
  objectId: string;
  before?: unknown;
  after?: unknown;
  detail?: Record<string, unknown>;
}

export async function recordAudit(db: SqlClient, actor: EditorialActor | null, input: AuditInput): Promise<string> {
  const rows = await db.query<{ id: string }>(
    `INSERT INTO audit_event (actor_id, actor_kind, action, object_type, object_id, before_hash, after_hash, session_id, detail)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
     RETURNING id::text AS id`,
    [
      actor ? (actor.kind === "agent" ? `agent:${actor.agentName ?? actor.id}` : actor.id) : null,
      actor ? actor.kind : "system",
      input.action,
      input.objectType,
      input.objectId,
      fingerprint(input.before),
      fingerprint(input.after),
      actor?.sessionId ?? null,
      input.detail ? JSON.stringify(input.detail) : null,
    ],
  );
  return rows[0].id;
}

/** مصدر الحجية من رابط السند: 1 أم القرى، 2 هيئة الخبراء، 3 الجهة المصدرة أو غيرها. */
export function sourceRankFromUrl(url: string): 1 | 2 | 3 {
  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return 3;
  }
  if (host === "uqn.gov.sa" || host.endsWith(".uqn.gov.sa")) return 1;
  if (host === "laws.boe.gov.sa" || host === "boe.gov.sa" || host.endsWith(".boe.gov.sa")) return 2;
  return 3;
}

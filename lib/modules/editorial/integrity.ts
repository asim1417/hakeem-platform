// حارس سلامة مخطط المكتب قبل أي كتابة.
// السبب: workflows يدوية في المستودع تشغّل `prisma db push`، وPrisma لا يمثّل الفهارس الجزئية الفريدة
// ولا المشغّلات، فقد يحذفها. إن غاب شيء منها تُقفل الكتابة بدل أن يعمل المكتب بلا قفل ولا سجل محمي.
import type { SqlClient } from "./db";
import { EditorialError } from "./types";

export const REQUIRED_INDEXES = ["editorial_change_open_target_uq", "editorial_change_source_ref_uq"] as const;
export const REQUIRED_TRIGGERS = [
  "audit_event_append_only",
  "audit_event_no_truncate",
  "review_decision_append_only",
  "editorial_change_guard",
  "change_set_guard",
] as const;

export async function checkDeskIntegrity(db: SqlClient): Promise<{ ok: boolean; missing: string[] }> {
  const indexes = await db.query<{ name: string }>(
    `SELECT indexname AS name FROM pg_indexes WHERE schemaname = current_schema() AND indexname = ANY($1::text[])`,
    [REQUIRED_INDEXES as unknown as string[]],
  );
  const triggers = await db.query<{ name: string }>(
    `SELECT tgname AS name FROM pg_trigger WHERE NOT tgisinternal AND tgname = ANY($1::text[])`,
    [REQUIRED_TRIGGERS as unknown as string[]],
  );
  const present = new Set([...indexes, ...triggers].map((r) => r.name));
  const missing = [...REQUIRED_INDEXES, ...REQUIRED_TRIGGERS].filter((name) => !present.has(name));
  return { ok: missing.length === 0, missing };
}

const verified = new WeakMap<object, number>();
const TTL_MS = 5 * 60 * 1000;

export async function assertDeskIntegrity(db: SqlClient): Promise<void> {
  const at = verified.get(db);
  if (at && Date.now() - at < TTL_MS) return;
  let result: { ok: boolean; missing: string[] };
  try {
    result = await checkDeskIntegrity(db);
  } catch {
    throw new EditorialError("INVALID_STATE", "تعذّر التحقق من سلامة جداول المكتب؛ الكتابة مقفلة.");
  }
  if (!result.ok) {
    throw new EditorialError("INVALID_STATE", "حمايات جداول المكتب ناقصة (فهارس القفل أو مشغّلات السجل)؛ الكتابة مقفلة حتى تُستعاد.", {
      missing: result.missing,
    });
  }
  verified.set(db, Date.now());
}

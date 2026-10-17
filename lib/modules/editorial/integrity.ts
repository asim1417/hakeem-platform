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
  "review_decision_no_truncate",
  "editorial_change_guard",
  "change_set_guard",
] as const;

/** المفاتيح الأجنبية لكل جدول: الدفعة (المؤلف، المتراجَع عنه)، والتغيير (الدفعة، المؤلف)، والقرار (الدفعة، المعتمِد)، والمزامنة (الدفعة). */
export const REQUIRED_FOREIGN_KEYS: Record<string, number> = {
  change_set: 2,
  editorial_change: 2,
  review_decision: 2,
  index_sync: 1,
};

export async function checkDeskIntegrity(db: SqlClient): Promise<{ ok: boolean; missing: string[] }> {
  const indexes = await db.query<{ name: string }>(
    `SELECT indexname AS name FROM pg_indexes WHERE schemaname = current_schema() AND indexname = ANY($1::text[])`,
    [REQUIRED_INDEXES as unknown as string[]],
  );
  const triggers = await db.query<{ name: string }>(
    `SELECT tgname AS name FROM pg_trigger WHERE NOT tgisinternal AND tgname = ANY($1::text[])`,
    [REQUIRED_TRIGGERS as unknown as string[]],
  );
  const fks = await db.query<{ table_name: string; n: number }>(
    `SELECT conrelid::regclass::text AS table_name, count(*)::int AS n
       FROM pg_constraint
      WHERE contype = 'f' AND conrelid::regclass::text = ANY($1::text[])
      GROUP BY 1`,
    [Object.keys(REQUIRED_FOREIGN_KEYS)],
  );
  const present = new Set([...indexes, ...triggers].map((r) => r.name));
  const missing: string[] = [...REQUIRED_INDEXES, ...REQUIRED_TRIGGERS].filter((name) => !present.has(name));
  for (const [table, expected] of Object.entries(REQUIRED_FOREIGN_KEYS)) {
    const found = fks.find((f) => f.table_name === table)?.n ?? 0;
    if (found < expected) missing.push(`${table}:foreign_keys(${found}/${expected})`);
  }
  return { ok: missing.length === 0, missing };
}

/** يُفحص عند كل كتابة بلا حفظ مؤقت (استعلامات فهرس صغيرة)، حتى لا يكتب خادمٌ فحص قبل حذف الحماية. */
export async function assertDeskIntegrity(db: SqlClient): Promise<void> {
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
}

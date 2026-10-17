// حارس سلامة مخطط المكتب قبل أي كتابة (ق-٩).
// السبب: workflows يدوية في المستودع تشغّل `prisma db push`، وPrisma لا يمثّل الفهارس الجزئية الفريدة
// ولا المشغّلات، فقد يحذفها. وقد يُعطَّل مشغّل (ALTER TABLE … DISABLE TRIGGER) أو يُربط بجدول آخر.
// إن غاب شيء منها تُقفل الكتابة بدل أن يعمل المكتب بلا قفل ولا سجل محمي.
import type { SqlClient } from "./db";
import { EditorialError } from "./types";

/** الفهارس الفريدة المطلوبة وجداولها. */
export const REQUIRED_INDEXES: Record<string, string> = {
  editorial_change_open_target_uq: "editorial_change",
  editorial_change_source_ref_uq: "editorial_change",
  review_decision_set_reviewer_uq: "review_decision",
  change_set_idempotency_uq: "change_set",
  index_sync_target_uq: "index_sync",
};

/** المشغّلات المطلوبة: جدولها ودالتها. يجب أن تكون مفعّلة في الوضع العادي (tgenabled O أو A). */
export const REQUIRED_TRIGGERS: Record<string, { table: string; fn: string }> = {
  audit_event_append_only: { table: "audit_event", fn: "editorial_append_only" },
  audit_event_no_truncate: { table: "audit_event", fn: "editorial_append_only" },
  review_decision_append_only: { table: "review_decision", fn: "editorial_append_only" },
  review_decision_no_truncate: { table: "review_decision", fn: "editorial_append_only" },
  editorial_change_guard: { table: "editorial_change", fn: "editorial_guard_change" },
  editorial_change_draft_only: { table: "editorial_change", fn: "editorial_change_draft_only" },
  editorial_change_no_truncate: { table: "editorial_change", fn: "editorial_append_only" },
  change_set_guard: { table: "change_set", fn: "editorial_guard_change_set" },
  change_set_no_truncate: { table: "change_set", fn: "editorial_append_only" },
  index_sync_no_truncate: { table: "index_sync", fn: "editorial_append_only" },
  editorial_config_append_only: { table: "editorial_config", fn: "editorial_append_only" },
  editorial_config_no_truncate: { table: "editorial_config", fn: "editorial_append_only" },
};

/** المفاتيح الأجنبية لكل جدول: الدفعة (المؤلف، المتراجَع عنه)، والتغيير (الدفعة، المؤلف)، والقرار (الدفعة، المعتمِد)، والمزامنة (الدفعة)، والإعدادات (المنفّذ). */
export const REQUIRED_FOREIGN_KEYS: Record<string, number> = {
  change_set: 2,
  editorial_change: 2,
  review_decision: 2,
  index_sync: 1,
  editorial_config: 1,
};

export async function checkDeskIntegrity(db: SqlClient): Promise<{ ok: boolean; missing: string[] }> {
  const indexes = await db.query<{ name: string; table_name: string; unique: boolean; valid: boolean }>(
    `SELECT ic.relname AS name, tc.relname AS table_name, i.indisunique AS unique, i.indisvalid AS valid
       FROM pg_index i
       JOIN pg_class ic ON ic.oid = i.indexrelid
       JOIN pg_class tc ON tc.oid = i.indrelid
      WHERE ic.relnamespace = current_schema()::regnamespace AND ic.relname = ANY($1::text[])`,
    [Object.keys(REQUIRED_INDEXES)],
  );
  // tgenabled: O = يعمل في الوضع العادي، A = دائمًا، R = في وضع النسخ فقط (معطّل عمليًّا)، D = معطّل.
  const triggers = await db.query<{ name: string; table_name: string; fn: string; enabled: string }>(
    `SELECT t.tgname AS name, c.relname AS table_name, p.proname AS fn, t.tgenabled::text AS enabled
       FROM pg_trigger t
       JOIN pg_class c ON c.oid = t.tgrelid
       JOIN pg_proc p ON p.oid = t.tgfoid
      WHERE NOT t.tgisinternal AND c.relnamespace = current_schema()::regnamespace AND t.tgname = ANY($1::text[])`,
    [Object.keys(REQUIRED_TRIGGERS)],
  );
  const fks = await db.query<{ table_name: string; n: number }>(
    `SELECT conrelid::regclass::text AS table_name, count(*)::int AS n
       FROM pg_constraint
      WHERE contype = 'f' AND conrelid::regclass::text = ANY($1::text[])
      GROUP BY 1`,
    [Object.keys(REQUIRED_FOREIGN_KEYS)],
  );
  const role = await db.query<{ role: string }>(`SELECT current_setting('session_replication_role') AS role`);

  const missing: string[] = [];
  for (const [name, table] of Object.entries(REQUIRED_INDEXES)) {
    const found = indexes.find((i) => i.name === name);
    if (!found) missing.push(name);
    else if (found.table_name !== table || !found.unique || !found.valid) missing.push(`${name}:invalid`);
  }
  for (const [name, expected] of Object.entries(REQUIRED_TRIGGERS)) {
    const found = triggers.filter((t) => t.name === name);
    const bound = found.find((t) => t.table_name === expected.table);
    if (!bound) missing.push(found.length ? `${name}:wrong_table` : name);
    else if (bound.fn !== expected.fn) missing.push(`${name}:wrong_function`);
    else if (bound.enabled !== "O" && bound.enabled !== "A") missing.push(`${name}:disabled`);
  }
  for (const [table, expected] of Object.entries(REQUIRED_FOREIGN_KEYS)) {
    const found = fks.find((f) => f.table_name === table)?.n ?? 0;
    if (found < expected) missing.push(`${table}:foreign_keys(${found}/${expected})`);
  }
  // في وضع replica لا تعمل مشغّلات O أصلًا.
  if (role[0]?.role !== "origin") missing.push(`session_replication_role:${role[0]?.role ?? "unknown"}`);
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
    // أسماء الفهارس والمشغّلات للسجل الخادمي وحده (ن٤)؛ العميل يتلقى رسالة عامة وعددًا.
    console.error("[editorial] desk integrity check failed", result.missing.join(", "));
    throw new EditorialError("INVALID_STATE", "حمايات جداول المكتب ناقصة أو معطّلة؛ الكتابة مقفلة حتى يستعيدها مهندس القاعدة.", {
      missingCount: result.missing.length,
    });
  }
}

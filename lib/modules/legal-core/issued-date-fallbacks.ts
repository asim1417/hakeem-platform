/**
 * HKM-064 — مصادر تاريخ الإصدار بعد البطاقة (law-card-dates.IssuedDateFallbacks) لمن لا يقرأ صفحة النظام كاملة:
 * hakeem_get_article (lib/mcp/tools/article-issuance.ts) وبطاقة /legal/<slug>.
 * القراءة نفسها التي تجريها صفحة النظام (law-page-data): آخر نسخة preamble_edition (created_at DESC, id DESC) وأول
 * وحدة issuing_instrument فيها بالترتيب، ثم آخر صف legal_system_issuance (created_at DESC). قراءة فقط.
 * غياب جدول = لا مصدر (سقوط آمن)، ولا يُسأل preamble_edition قبل التحقق من وجوده (لا prisma:error في الإنتاج).
 */
import { isMissingRelation, relationExists, type SqlClient } from "./sql-port";
import type { IssuedDateFallbacks } from "./law-card-dates";

export const PREAMBLE_FIRST_INSTRUMENT_DATE_SQL = `SELECT (
  SELECT u.instrument_date_hijri FROM preamble_unit u
   WHERE u.edition_id = (SELECT e.id FROM preamble_edition e WHERE e.system_id = $1 ORDER BY e.created_at DESC, e.id DESC LIMIT 1)
     AND u.unit_type = 'issuing_instrument'
   ORDER BY u.ordinal LIMIT 1
) AS preamble_hijri`;

export const LATEST_ISSUANCE_DATE_SQL = `SELECT issue_date_hijri, issue_date_greg::text AS issue_date_greg
  FROM legal_system_issuance WHERE system_id = $1 ORDER BY created_at DESC LIMIT 1`;

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (isMissingRelation(e)) return fallback;
    throw e;
  }
}

export async function loadIssuedDateFallbacks(db: SqlClient, systemId: string): Promise<IssuedDateFallbacks> {
  const [preambleHijri, issuance] = await Promise.all([
    relationExists(db, "preamble_edition").then((exists) =>
      exists
        ? safe(() => db.query<{ preamble_hijri: string | null }>(PREAMBLE_FIRST_INSTRUMENT_DATE_SQL, [systemId]), []).then((r) => r[0]?.preamble_hijri ?? null)
        : null,
    ),
    safe(() => db.query<{ issue_date_hijri: string | null; issue_date_greg: string | null }>(LATEST_ISSUANCE_DATE_SQL, [systemId]), []).then((r) => r[0] ?? null),
  ]);
  return {
    preambleHijri: preambleHijri || null,
    issuanceHijri: issuance?.issue_date_hijri || null,
    issuanceGregorian: issuance?.issue_date_greg ? String(issuance.issue_date_greg).slice(0, 10) : null,
  };
}

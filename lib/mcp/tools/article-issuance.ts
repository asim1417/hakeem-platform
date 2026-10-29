/**
 * HKM-053 — أداة إصدار المادة في hakeem_get_article من بطاقة نظامها.
 *
 * العلة: issued_by كان يُقرأ من عمود royalDecree على المادة (فارغ في أغلب المواد)، وissued_date_h ثابتًا null،
 * فيرجعان فارغين لنظامي الإفلاس والإثبات مع أن بطاقة النظام (law_card) فيها أداة الإصدار وتاريخه.
 * البطاقة الحالية هي آخر صف لكل نظام (created_at DESC, id DESC) كما في صفحة النظام. قراءة فقط.
 */
import type { SqlClient } from "../../modules/legal-core/sql-port";
import { parseInstrumentHeading } from "../../modules/legal-core/preamble-parser";

export interface LawCardIssuanceRow {
  issued_hijri: string | null;
  instruments: unknown;
}

export interface ArticleIssuance {
  issuedBy: string | null;
  issuedDateH: string | null;
}

/** أول أداة إصدار في البطاقة وتاريخ إصدار النظام (من البطاقة، وإلا من نص الأداة). نقية. */
export function issuanceFromCard(card: LawCardIssuanceRow | null): ArticleIssuance {
  if (!card) return { issuedBy: null, issuedDateH: null };
  const list = Array.isArray(card.instruments) ? (card.instruments as Array<{ text?: unknown }>) : [];
  const first = list.map((i) => (typeof i?.text === "string" ? i.text.trim() : "")).find((t) => t.length > 0) ?? null;
  const issuedDateH = card.issued_hijri?.trim() || (first ? parseInstrumentHeading(first).dateHijri : null);
  return { issuedBy: first, issuedDateH: issuedDateH || null };
}

/** البطاقة الحالية للنظام (أو null). */
export async function loadLawCardIssuance(db: SqlClient, systemId: string): Promise<LawCardIssuanceRow | null> {
  const rows = await db.query<LawCardIssuanceRow>(
    `SELECT issued_hijri, instruments FROM law_card WHERE system_id = $1 ORDER BY created_at DESC, id DESC LIMIT 1`,
    [systemId],
  );
  return rows[0] ?? null;
}

/**
 * أداة إصدار المادة: عمود المادة إن وُجد (أداة على مستوى المادة، فلا يُنسب لها تاريخ البطاقة)،
 * وإلا أداة النظام وتاريخه من البطاقة.
 */
export function articleIssuance(royalDecree: string | null | undefined, card: LawCardIssuanceRow | null): ArticleIssuance {
  const own = royalDecree?.trim();
  if (own) return { issuedBy: own, issuedDateH: null };
  return issuanceFromCard(card);
}

/**
 * HKM-053 — أداة إصدار المادة في hakeem_get_article من بطاقة نظامها.
 *
 * العلة: issued_by كان يُقرأ من عمود royalDecree على المادة (فارغ في أغلب المواد)، وissued_date_h ثابتًا null،
 * فيرجعان فارغين لنظامي الإفلاس والإثبات مع أن بطاقة النظام (law_card) فيها أداة الإصدار وتاريخه.
 * البطاقة الحالية هي آخر صف لكل نظام (created_at DESC, id DESC) كما في صفحة النظام. قراءة فقط.
 *
 * HKM-064 — تاريخ الإصدار بقواعد صفحة النظام (law-card-dates):
 *   تاريخ البطاقة النائب (الإصدار والنشر 1 محرم من سنة واحدة، مثل 1372/01/01 في «نظام نقابة السيارات») مجهول،
 *   فيسقط issued_date_h إلى مصادر الصفحة التالية: تاريخ أول أداة إصدار في وحدات المقدمة ← legal_system_issuance ← null.
 *   وكذلك إن لم تكن للنظام بطاقة. فيتفق issued_date_h هنا مع dates.issued.hijri في hakeem_get_law.
 *   issued_by كما كان (أول أداة في البطاقة). التوقيعان كما هما (adapter.ts لا يتغير).
 */
import type { SqlClient } from "../../modules/legal-core/sql-port";
import { parseInstrumentHeading } from "../../modules/legal-core/preamble-parser";
import { cardDatePlaceholders, issuedDateFallback, type IssuedDateFallbacks } from "../../modules/legal-core/law-card-dates";
import { loadIssuedDateFallbacks } from "../../modules/legal-core/issued-date-fallbacks";

export interface LawCardIssuanceRow {
  issued_hijri: string | null;
  instruments: unknown;
  /** HKM-064: لكشف التاريخ النائب (يُقرأ ::text). غيابها في الاستدعاءات القديمة = غير معروف. */
  issued_gregorian?: string | null;
  published_hijri?: string | null;
  published_gregorian?: string | null;
  /** HKM-064: مصادر الإصدار التالية (تُقرأ فقط حين يلزم: لا بطاقة، أو تاريخها نائب). */
  fallback?: IssuedDateFallbacks | null;
}

export interface ArticleIssuance {
  issuedBy: string | null;
  issuedDateH: string | null;
}

/** هل تاريخ الإصدار في البطاقة نائب (law-card-dates)؟ */
function issuedPlaceholder(card: LawCardIssuanceRow): boolean {
  return cardDatePlaceholders({
    issuedHijri: card.issued_hijri,
    issuedGregorian: card.issued_gregorian ?? null,
    publishedHijri: card.published_hijri ?? null,
    publishedGregorian: card.published_gregorian ?? null,
  }).issued;
}

/**
 * أول أداة إصدار في البطاقة، وتاريخ إصدار النظام: من البطاقة إن لم يكن نائبًا (وإلا من نص أول أداة إن غاب فيها)،
 * ثم مصادر الصفحة التالية (fallback). نقية.
 */
export function issuanceFromCard(card: LawCardIssuanceRow | null): ArticleIssuance {
  if (!card) return { issuedBy: null, issuedDateH: null };
  const list = Array.isArray(card.instruments) ? (card.instruments as Array<{ text?: unknown }>) : [];
  const first = list.map((i) => (typeof i?.text === "string" ? i.text.trim() : "")).find((t) => t.length > 0) ?? null;
  const own = issuedPlaceholder(card) ? null : card.issued_hijri?.trim() || (first ? parseInstrumentHeading(first).dateHijri : null);
  const issuedDateH = own || issuedDateFallback(card.fallback).hijri;
  return { issuedBy: first, issuedDateH: issuedDateH || null };
}

/**
 * البطاقة الحالية للنظام، ومعها مصادر الإصدار التالية حين يلزم (لا بطاقة، أو تاريخها نائب).
 * null = لا بطاقة ولا مصدر تالٍ.
 */
export async function loadLawCardIssuance(db: SqlClient, systemId: string): Promise<LawCardIssuanceRow | null> {
  const rows = await db.query<LawCardIssuanceRow>(
    `SELECT issued_hijri, instruments, issued_gregorian::text AS issued_gregorian, published_hijri, published_gregorian::text AS published_gregorian
       FROM law_card WHERE system_id = $1 ORDER BY created_at DESC, id DESC LIMIT 1`,
    [systemId],
  );
  const card = rows[0] ?? null;
  if (card && !issuedPlaceholder(card) && card.issued_hijri?.trim()) return card;
  const fallback = await loadIssuedDateFallbacks(db, systemId);
  if (card) return { ...card, fallback };
  return issuedDateFallback(fallback).hijri ? { issued_hijri: null, instruments: [], fallback } : null;
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

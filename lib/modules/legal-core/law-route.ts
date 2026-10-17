/**
 * HKM-023-B (ع-١٥) — حسم معرّف المسار `/law/<معرّف>` إلى نظام. قراءة فقط عبر SqlClient.
 * المعرّف الدائم بأداة الإصدار (m-43-1443) غير مخزّن بعد، فالمعرّف الكنسي اليوم هو eliSlug المجمّد
 * (أو اشتقاقه من الاسم)، ويُقبل معرّف القاعدة الداخلي للتوافق ثم يُحوَّل إلى الكنسي.
 */
import type { SqlClient } from "./sql-port";
import { lawSlug, resolveSystemSlug } from "./eli";

export interface ResolvedLaw {
  systemId: string;
  name: string;
  /** المعرّف الكنسي للمسار. */
  canonicalId: string;
  /** true إن جاء الطلب بغير الكنسي (معرّف داخلي أو إملاء آخر) فيُحوَّل. */
  nonCanonical: boolean;
}

export async function resolveLawRoute(db: SqlClient, rawParam: string): Promise<ResolvedLaw | null> {
  const raw = decodeURIComponent(rawParam).trim();
  if (!raw) return null;
  const norm = lawSlug(raw);
  const pick = (r: { id: string; name: string; eli_slug: string | null }): ResolvedLaw => {
    const canonicalId = resolveSystemSlug(r.eli_slug, r.name);
    return { systemId: r.id, name: r.name, canonicalId, nonCanonical: canonicalId !== raw };
  };
  const byEli = await db.query<{ id: string; name: string; eli_slug: string | null }>(`SELECT id, name, eli_slug FROM legal_systems WHERE eli_slug = $1 LIMIT 1`, [norm]);
  if (byEli[0]) return pick(byEli[0]);
  const byId = await db.query<{ id: string; name: string; eli_slug: string | null }>(`SELECT id, name, eli_slug FROM legal_systems WHERE id = $1 LIMIT 1`, [raw]);
  if (byId[0]) return pick(byId[0]);
  const all = await db.query<{ id: string; name: string; eli_slug: string | null }>(`SELECT id, name, eli_slug FROM legal_systems`);
  const m = all.find((x) => resolveSystemSlug(x.eli_slug, x.name) === norm);
  return m ? pick(m) : null;
}

/** المعرّف الكنسي لنظام بمعرّفه الداخلي (لتحويل روابط اللوحة القديمة). */
export async function canonicalLawIdFor(db: SqlClient, systemId: string): Promise<string | null> {
  const r = await db.query<{ name: string; eli_slug: string | null }>(`SELECT name, eli_slug FROM legal_systems WHERE id = $1 LIMIT 1`, [systemId]);
  return r[0] ? resolveSystemSlug(r[0].eli_slug, r[0].name) : null;
}

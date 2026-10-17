/**
 * HKM-023-B ع-١٣ — مطابقة اسم النظام في hakeem_get_law.
 *
 * العلة (تحقق 17/10/2026): getLaw كان يطلب findFirst({ name contains }) مرتبًا بعدد المواد تنازليًا، فيفوز الأطول:
 *   «نظام الإثبات» (129 مادة) ← «الأدلة الإجرائية لنظام الإثبات» (135)،
 *   «نظام المرافعات الشرعية» (242) ← «اللوائح التنفيذية لنظام المرافعات الشرعية» (639).
 *
 * الترتيب الجديد: المطابقة التامة للاسم المطبَّع أولًا، ثم «يبدأ بـ»، ثم الاحتواء. داخل الدرجة: الأصل قبل التابع
 * (لائحة/لوائح/قواعد/ضوابط/أدلة…) ما لم يطلب المُدخل التابع، ثم الأقصر اسمًا، ثم الأكثر مواد. عند التعدد يُعاد
 * الأول مع قائمة البدائل. نقي (والقراءة عبر SqlClient في findLawByName).
 */
import { bareText } from "./preamble-parser";
import type { SqlClient } from "./sql-port";

export type LawMatchType = "id" | "exact" | "prefix" | "contains" | "none";

export interface LawCandidate {
  id: string;
  name: string;
  articleCount: number;
}

export interface LawNameMatch {
  match: LawCandidate | null;
  matchType: LawMatchType;
  /** بدائل مرتبة (بلا المختار)، بحد أعلى 8. */
  alternatives: LawCandidate[];
}

/** تطبيع الاسم للمقارنة: بلا تشكيل ولا تطويل، همزات وتاء مربوطة وألف مقصورة موحّدة، بلا سنة ملتصقة ولا ترقيم. */
export function normalizeLawName(input: string | null | undefined): string {
  return bareText(String(input ?? ""))
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/\d{3,4}\s*[هم]?(?=\s|$)/g, " ")
    .replace(/[()«»"'.,،:؛\-–—]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// «تابع» = لائحة أو قاعدة أو دليل… لنظام آخر. لا يُختار للاسم المجرد إلا إن طلبه المُدخل.
const SUBORDINATE = /^(?:ال)?(?:لائحه|لوائح|قواعد|ضوابط|دليل|ادله|اليه|الاليه|تعليمات|اجراءات|نماذج|معايير|اشتراطات|ترتيبات تنفيذيه)(?:\s|$)/;
export function isSubordinateName(normalized: string): boolean {
  return SUBORDINATE.test(normalized);
}

function rank(cands: Array<{ c: LawCandidate; n: string }>, wantsSub: boolean) {
  return [...cands].sort((a, b) => {
    const as = !wantsSub && isSubordinateName(a.n) ? 1 : 0;
    const bs = !wantsSub && isSubordinateName(b.n) ? 1 : 0;
    if (as !== bs) return as - bs;
    if (a.n.length !== b.n.length) return a.n.length - b.n.length;
    if (a.c.articleCount !== b.c.articleCount) return b.c.articleCount - a.c.articleCount;
    return a.c.id.localeCompare(b.c.id);
  });
}

/** يرتب المرشحين لاسم: تامة ← يبدأ بـ ← احتواء. */
export function rankLawNameMatches(candidates: LawCandidate[], name: string): LawNameMatch {
  const q = normalizeLawName(name);
  if (!q) return { match: null, matchType: "none", alternatives: [] };
  const wantsSub = isSubordinateName(q);
  const all = candidates.map((c) => ({ c, n: normalizeLawName(c.name) })).filter((x) => x.n);
  const exact = all.filter((x) => x.n === q);
  const prefix = all.filter((x) => x.n !== q && x.n.startsWith(q));
  const contains = all.filter((x) => x.n !== q && !x.n.startsWith(q) && x.n.includes(q));
  const tiers: Array<[LawMatchType, typeof all]> = [["exact", exact], ["prefix", prefix], ["contains", contains]];
  for (let i = 0; i < tiers.length; i++) {
    const [type, tier] = tiers[i];
    if (!tier.length) continue;
    const ordered = rank(tier, wantsSub);
    // البدائل: بقية الدرجة ثم الدرجات التالية (للاقتراح فقط).
    const rest = [...ordered.slice(1), ...tiers.slice(i + 1).flatMap(([, t]) => rank(t, wantsSub))];
    return { match: ordered[0].c, matchType: type, alternatives: rest.slice(0, 8).map((x) => x.c) };
  }
  return { match: null, matchType: "none", alternatives: [] };
}

/** يحل اسمًا من القاعدة (قراءة فقط). */
export async function findLawByName(db: SqlClient, name: string): Promise<LawNameMatch> {
  const rows = await db.query<{ id: string; name: string; articleCount: number }>(`SELECT id, name, "articleCount" FROM legal_systems`);
  return rankLawNameMatches(rows.map((r) => ({ id: r.id, name: r.name, articleCount: Number(r.articleCount) || 0 })), name);
}

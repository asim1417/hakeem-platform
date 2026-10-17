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
 *
 * حافتان (مراجعة الجودة ن٣):
 *   • السنة في المُدخل («نظام التنفيذ 1433») تُحذف من المقارنة، لكنها تُقدِّم من يحمل اسمُه تلك السنة: أول درجة فيها
 *     مرشح بالسنة نفسها يُختار منها، والبقية بدائل.
 *   • داخل الدرجة يتأخر النظام الملغى أو المستبدل (آخر سجل تحقق للعمل) عن الساري: «تنظيم المؤسسة العامة للري» يعيد
 *     طبعة 1447 لا طبعة 2018. findLawByName يقرأ حالات المرشحين فقط حين يتعدد المرشحون.
 */
import { bareText } from "./preamble-parser";
import { isMissingRelation, type SqlClient } from "./sql-port";

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

const toLatinDigits = (s: string) => s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));

/** السنوات المذكورة في المُدخل (هجرية 13xx/14xx أو ميلادية 19xx/20xx). */
export function queryYears(name: string): string[] {
  return [...toLatinDigits(String(name ?? "")).matchAll(/(?:^|\D)((?:13|14|19|20)\d\d)(?=\D|$)/g)].map((m) => m[1]);
}

export interface RankOptions {
  /** معرّفات أنظمة ملغاة أو مستبدلة: تتأخر داخل درجتها. */
  retired?: ReadonlySet<string>;
}

function rank(cands: Array<{ c: LawCandidate; n: string }>, wantsSub: boolean, years: string[] = [], retired: ReadonlySet<string> = new Set()) {
  const yearHit = (c: LawCandidate) => (years.length && years.some((y) => toLatinDigits(c.name).includes(y)) ? 0 : 1);
  return [...cands].sort((a, b) => {
    if (years.length && yearHit(a.c) !== yearHit(b.c)) return yearHit(a.c) - yearHit(b.c);
    const as = !wantsSub && isSubordinateName(a.n) ? 1 : 0;
    const bs = !wantsSub && isSubordinateName(b.n) ? 1 : 0;
    if (as !== bs) return as - bs;
    const ar = retired.has(a.c.id) ? 1 : 0;
    const br = retired.has(b.c.id) ? 1 : 0;
    if (ar !== br) return ar - br;
    if (a.n.length !== b.n.length) return a.n.length - b.n.length;
    if (a.c.articleCount !== b.c.articleCount) return b.c.articleCount - a.c.articleCount;
    return a.c.id.localeCompare(b.c.id);
  });
}

/** يرتب المرشحين لاسم: تامة ← يبدأ بـ ← احتواء. */
export function rankLawNameMatches(candidates: LawCandidate[], name: string, opts: RankOptions = {}): LawNameMatch {
  const q = normalizeLawName(name);
  if (!q) return { match: null, matchType: "none", alternatives: [] };
  const wantsSub = isSubordinateName(q);
  const years = queryYears(name);
  const retired = opts.retired ?? new Set<string>();
  const all = candidates.map((c) => ({ c, n: normalizeLawName(c.name) })).filter((x) => x.n);
  const exact = all.filter((x) => x.n === q);
  const prefix = all.filter((x) => x.n !== q && x.n.startsWith(q));
  const contains = all.filter((x) => x.n !== q && !x.n.startsWith(q) && x.n.includes(q));
  const tiers: Array<[LawMatchType, typeof all]> = [["exact", exact], ["prefix", prefix], ["contains", contains]];
  const ranked = tiers.map(([type, tier]) => [type, rank(tier, wantsSub, years, retired)] as const);
  // السنة المطلوبة: أول درجة فيها اسم يحمل السنة، وإلا أول درجة غير فارغة.
  const hasYear = (c: LawCandidate) => years.some((y) => toLatinDigits(c.name).includes(y));
  let at = years.length ? ranked.findIndex(([, t]) => t.some((x) => hasYear(x.c))) : -1;
  if (at < 0) at = ranked.findIndex(([, t]) => t.length > 0);
  if (at < 0) return { match: null, matchType: "none", alternatives: [] };
  const [type, ordered] = ranked[at];
  // البدائل: بقية المرشحين بترتيب الدرجات (للاقتراح فقط).
  const rest = ranked.flatMap(([, t], i) => (i === at ? t.slice(1) : t));
  return { match: ordered[0].c, matchType: type, alternatives: rest.slice(0, 8).map((x) => x.c) };
}

/** يحل اسمًا من القاعدة (قراءة فقط). */
const RETIRED_STATUSES = ["ملغى", "مستبدل", "ملغى مع بقاء أحكام محددة مؤقتًا"];

export async function findLawByName(db: SqlClient, name: string): Promise<LawNameMatch> {
  const rows = await db.query<{ id: string; name: string; articleCount: number }>(`SELECT id, name, "articleCount" FROM legal_systems`);
  const cands = rows.map((r) => ({ id: r.id, name: r.name, articleCount: Number(r.articleCount) || 0 }));
  const first = rankLawNameMatches(cands, name);
  if (!first.match || !first.alternatives.length) return first;
  // حالات المرشحين فقط (لا مسح لكل التحقق)، ليتأخر الملغى عن الساري داخل الدرجة.
  const ids = [first.match.id, ...first.alternatives.map((a) => a.id)];
  let retired = new Set<string>();
  try {
    const st = await db.query<{ object_id: string; verified_status: string }>(
      `SELECT DISTINCT ON (object_id) object_id, verified_status FROM verification
        WHERE object_type = 'work' AND object_id = ANY($1::text[]) ORDER BY object_id, verified_at DESC, id DESC`,
      [ids],
    );
    retired = new Set(st.filter((r) => RETIRED_STATUSES.includes(r.verified_status)).map((r) => r.object_id));
  } catch (e) {
    if (!isMissingRelation(e)) throw e;
  }
  return retired.size ? rankLawNameMatches(cands, name, { retired }) : first;
}

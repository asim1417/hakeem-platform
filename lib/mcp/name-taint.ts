/**
 * HKM-012 — اللفظ الذي يطابق داخل أسماء الأفراد غالبًا يُعدّ غير مطابق أصلًا في أدوات الأحكام في الموصل.
 *
 * search_norm مبني من النص الخام، فالاسم يطابق في القاعدة وإن حُجب في المخرج. فحص كل نتيجة وحده لا يكفي:
 * العدد والتوزيع والمؤشر تُحسب في القاعدة على كل المطابقات. فيُفحص اللفظ نفسه على عيّنة من الأحكام التي
 * تطابقه (بالقاعدة نفسها، بلا مرشحات ولا مؤشر)، ويُعاد حساب المطابقة على نسختها المحجوبة. إن لم يطابق
 * النسخةَ المحجوبة في نصف العيّنة فأكثر، فهو لفظ اسم: يُعامل كأنه لا يطابق شيئًا (كما لو كان الفهرس محجوبًا)،
 * فلا يظهر له حكم ولا عدد ولا توزيع، ولا يختلف المخرج عن لفظ غائب عن القاعدة.
 *
 * العيّنة أصغر المعرّفات المطابقة (حتمية)، على فهرس search_norm (GIN، والمسح التسلسلي معطّل في معاملتها)،
 * وحكمها يُحفظ مؤقتًا لكل لفظ (العيّنة ثابتة)، ولا يجري أكثر من أربعة استعلامات عيّنة في وقت واحد في المثيل.
 *
 * الحل الجذري بناء search_norm وأجزاء الأحكام والمتجهات من النص المحجوب (كتابة على الإنتاج باعتماد المالك).
 */
import { maskPersonalData } from "@/lib/rulings/research/mask";
import { runRulingSearchSql } from "@/lib/modules/legal-core/rulings-search";
import {
  enumerateTermVisible,
  lexicalVisible,
  maskedMatchWords,
  maskedSearchNorm,
  normWordList,
  phraseInWords,
  phraseTsQuery,
  type EnumerateTerm,
  type PhraseQuery,
  type RulingIndexFields,
} from "@/lib/mcp/ruling-privacy";

/** حجم العيّنة ونسبة المطابقة داخل الأسماء التي تجعل اللفظ لفظ اسم. */
export const TAINT_SAMPLE = 12;
export const TAINT_RATIO = 0.5;

export const INDEX_FIELDS_SQL = `r."id", r."court", r."judgmentTitle", r."judgmentText", r."appealText", r."caseNo", r."decisionNo", r."cityName"`;
export type IndexRow = RulingIndexFields & { id: string };

/** لفظ اسم إن لم يطابق النسخةَ المحجوبة في نصف العيّنة فأكثر. العيّنة الفارغة: اللفظ غائب، فلا يُحكم بشيء. */
export function taintedBySample<T>(rows: T[], visible: (r: T) => boolean): boolean {
  if (!rows.length) return false;
  const hidden = rows.filter((r) => !visible(r)).length;
  return hidden / rows.length >= TAINT_RATIO;
}

// ── حفظ مؤقت وحد للتوازي ──
const CACHE_TTL_MS = 10 * 60_000;
const CACHE_MAX = 1000;
const cache = new Map<string, { tainted: boolean; at: number }>();
const MAX_CONCURRENT = 4;
let running = 0;
const waiting: Array<() => void> = [];

async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (running >= MAX_CONCURRENT) await new Promise<void>((resolve) => waiting.push(resolve));
  running++;
  try {
    return await fn();
  } finally {
    running--;
    waiting.shift()?.();
  }
}

async function cached(key: string, compute: () => Promise<boolean>): Promise<boolean> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.tainted;
  const tainted = await withSlot(compute);
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
  cache.set(key, { tainted, at: Date.now() });
  return tainted;
}

/** للاختبار: يفرغ الحفظ المؤقت. */
export function clearTaintCache(): void {
  cache.clear();
}

const TSV = `to_tsvector('simple', coalesce(r."search_norm",''))`;

/** عيّنة حتمية: أصغر TAINT_SAMPLE معرّفًا يطابقها الشرط (المعرّفات كلها من الفهرس أولًا، ثم الترتيب). */
function sampleRows(cond: string, params: unknown[]): Promise<IndexRow[]> {
  return runRulingSearchSql<IndexRow[]>(
    `WITH m AS MATERIALIZED (SELECT r."id" FROM "judicial_cases" r WHERE ${cond})
     SELECT ${INDEX_FIELDS_SQL} FROM "judicial_cases" r
     JOIN (SELECT "id" FROM m ORDER BY "id" LIMIT ${TAINT_SAMPLE}) s ON s."id" = r."id"
     ORDER BY r."id"`,
    params,
    true,
  );
}

/**
 * استعلام البحث كله: ألفاظه بـ AND كما يبحث searchRulingsDirect. لفظ اسم إن غلبت الأسماء على عيّنته، إلا أن
 * تكون عبارته المتجاورة كما كُتبت («حسن النية») ظاهرة خارج الأسماء في أغلب عيّنتها.
 */
export async function lexicalQueryTainted(groups: string[][], phrase: PhraseQuery | null): Promise<boolean> {
  if (!groups.length) return false;
  const andQ = groups.map((g) => `(${g.join(" | ")})`).join(" & ");
  const andTainted = await cached(`sa:${andQ}`, async () => {
    const rows = await sampleRows(`${TSV} @@ to_tsquery('simple', $1)`, [andQ]);
    return taintedBySample(rows, (r) => lexicalVisible(maskedMatchWords(r), groups));
  });
  if (!andTainted || !phrase || phrase.groups.length < 2) return andTainted;
  const phQ = phraseTsQuery(phrase);
  return cached(`sp:${phQ}`, async () => {
    const rows = await sampleRows(`${TSV} @@ to_tsquery('simple', $1)`, [phQ]);
    // عيّنة العبارة الفارغة لا تشهد بشيء، فيبقى الحكم للعيّنة الأولى.
    if (!rows.length) return true;
    return taintedBySample(rows, (r) => phraseInWords(normWordList(maskedSearchNorm(r)), phrase));
  });
}

/** لفظ الحصر: عيّنة من الأحكام التي يطابقها شرطه وحده (cond بمعاملاته)، بلا مرشحات ولا مؤشر. */
export async function enumerateTermTainted(term: EnumerateTerm, cond: string, params: unknown[]): Promise<boolean> {
  return cached(`e:${JSON.stringify(term)}`, async () => {
    const rows = await sampleRows(cond, params);
    return taintedBySample(rows, (r) =>
      enumerateTermVisible(term, {
        maskedWords: () => normWordList(maskedSearchNorm(r)),
        maskedTitleText: () => `${maskPersonalData(r.judgmentTitle)}\n${maskPersonalData(r.judgmentText)}`,
        caseNo: r.caseNo,
        decisionNo: r.decisionNo,
      }),
    );
  });
}

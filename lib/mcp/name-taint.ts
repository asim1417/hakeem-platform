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
import { rulingSegmentsReady, runRulingSearchSql } from "@/lib/modules/legal-core/rulings-search";
import {
  SEARCH_NORM_TEXT_CAP,
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

// المتن والاستئناف بسقف search_norm (العيّنة تطابق search_norm وحده، وهو مبني منهما مقصوصين): يحدّ كلفة الحجب في
// العيّنة فيبقى دون أدنى الزمن، ويقلّل المنقول.
export const INDEX_FIELDS_SQL = `r."id", r."court", r."judgmentTitle", left(r."judgmentText", ${SEARCH_NORM_TEXT_CAP}) AS "judgmentText", left(r."appealText", ${SEARCH_NORM_TEXT_CAP}) AS "appealText", r."caseNo", r."decisionNo", r."cityName"`;
// عيّنة استعلام البحث (يطابقه البحث في المتن كاملًا عبر أجزاء الأحكام، ويُفحص كل حكم على المتن المحجوب كاملًا)
// واللفظ الحساس في الحصر (يطابق المتن المنقّح كاملًا) بالمتن حتى FULL_TEXT_CAP: أطول حكم في الإنتاج نحو 95 ألف حرف
// وp99 نحو 29 ألفًا، والسقف يحدّ أسوأ عيّنة دون أدنى الزمن (وما بعده يُعدّ غير ظاهر، فيميل الحكم إلى الحجب).
const FULL_TEXT_CAP = 60_000;
const FULL_FIELDS_SQL = `r."id", r."court", r."judgmentTitle", left(r."judgmentText", ${FULL_TEXT_CAP}) AS "judgmentText", left(r."appealText", ${SEARCH_NORM_TEXT_CAP}) AS "appealText", r."caseNo", r."decisionNo", r."cityName"`;
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
/** حساب قيد التنفيذ لكل مفتاح: النداءات المتزامنة على اللفظ نفسه تنتظر حسابًا واحدًا. */
const inflight = new Map<string, Promise<boolean>>();
const MAX_CONCURRENT = 4;
/** طابور الانتظار مسقوف وانتظاره محدود؛ الامتلاء والمهلة خطأ، والخطأ عند المستدعي اسم (السقوط مغلقًا). */
const MAX_WAITING = 32;
let waitMs = 5_000;
let running = 0;
const waiting: Array<() => void> = [];

async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (running < MAX_CONCURRENT) running++;
  else {
    if (waiting.length >= MAX_WAITING) throw new Error("name-taint: queue full");
    // الفتحة تُسلَّم للمنتظر عند تحريرها (لا ينقص العدّاد بينهما)، فلا يسبقه نداء جديد ولا يتجاوز الحد.
    await new Promise<void>((resolve, reject) => {
      const wake = () => {
        clearTimeout(timer);
        resolve();
      };
      const timer = setTimeout(() => {
        const i = waiting.indexOf(wake);
        if (i !== -1) waiting.splice(i, 1);
        reject(new Error("name-taint: wait timeout"));
      }, waitMs);
      waiting.push(wake);
    });
  }
  try {
    return await fn();
  } finally {
    const next = waiting.shift();
    if (next) next();
    else running--;
  }
}

/**
 * أدنى زمن لحساب عيّنة غير محفوظة: عيّنة لفظ الاسم فيها أحكام تُحجب، وعيّنة اللفظ الغائب فارغة، فيختلف زمنهما.
 * الحد الأدنى يسوّيهما (الحجب في العيّنة دونه عادةً)، والانتظار خارج فتحة التوازي.
 */
let sampleFloorMs = 1_000;
/** للاختبار: يغيّر أدنى زمن العيّنة. */
export function setTaintSampleFloorMs(ms: number): void {
  sampleFloorMs = ms;
}

async function cached(key: string, compute: () => Promise<boolean>): Promise<boolean> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.tainted;
  const pending = inflight.get(key);
  if (pending) return pending;
  const t0 = Date.now();
  const p = withSlot(compute)
    .then(async (tainted) => {
      const rest = sampleFloorMs - (Date.now() - t0);
      if (rest > 0) await new Promise((r) => setTimeout(r, rest));
      if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
      cache.set(key, { tainted, at: Date.now() });
      return tainted;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

/** للاختبار: يفرغ الحفظ المؤقت. */
export function clearTaintCache(): void {
  cache.clear();
}

/** للاختبار: حالة حد التوازي، وتشغيل مهمة في فتحته، ومهلة الانتظار. */
export function taintSlotState(): { running: number; waiting: number } {
  return { running, waiting: waiting.length };
}
export const taintLimiterForTest = {
  run: <T>(fn: () => Promise<T>): Promise<T> => withSlot(fn),
  setWaitMs: (ms: number): void => {
    waitMs = ms;
  },
};

const TSV = `to_tsvector('simple', coalesce(r."search_norm",''))`;

/** عيّنة حتمية: أصغر TAINT_SAMPLE معرّفًا يطابقها الشرط (المعرّفات كلها من الفهرس أولًا، ثم الترتيب). */
function sampleRows(cond: string, params: unknown[], fullText = false, extraIdsSql = ""): Promise<IndexRow[]> {
  // extraIdsSql: مصدر معرّفات آخر بـ UNION (لا OR: الجمع بـ OR مع استعلام فرعي يُلزم المخطِّط بمسح كامل، 71 ثانية
  // للفظ شائع بخطة التنفيذ على الإنتاج؛ وبـ UNION فهرسان، 0.27 ثانية).
  return runRulingSearchSql<IndexRow[]>(
    `WITH m AS MATERIALIZED (SELECT r."id" FROM "judicial_cases" r WHERE ${cond}${extraIdsSql ? ` UNION ${extraIdsSql}` : ""})
     SELECT ${fullText ? FULL_FIELDS_SQL : INDEX_FIELDS_SQL} FROM "judicial_cases" r
     JOIN (SELECT "id" FROM m ORDER BY "id" LIMIT ${TAINT_SAMPLE}) s ON s."id" = r."id"
     ORDER BY r."id"`,
    params,
    true,
  );
}

/**
 * استعلام البحث كله: ألفاظه بـ AND كما يبحث searchRulingsDirect. لفظ اسم إن غلبت الأسماء على عيّنته، إلا أن
 * تكون عبارته المتجاورة كما كُتبت («حسن النية») ظاهرة خارج الأسماء في أغلب عيّنتها. العيّنتان تجريان معًا دائمًا
 * (لا عيّنة العبارة بعد حكم الأولى)، فلا يختلف عدد الاستعلامات بين لفظ اسم ولفظ غائب. والمفاتيح بالصيغ المطبّعة.
 */
export async function lexicalQueryTainted(groups: string[][], phrase: PhraseQuery | null): Promise<boolean> {
  if (!groups.length) return false;
  const andQ = groups.map((g) => `(${g.join(" | ")})`).join(" & ");
  const phQ = phrase && phrase.groups.length >= 2 ? phraseTsQuery(phrase) : null;
  // search_norm المحجوب محسوب مرة لكل حكم في العيّنتين؛ وعيّنة الاستعلام تضيف كلمات المتن المحجوب كاملًا (كفحص
  // نتائج البحث)، وعيّنة العبارة على search_norm وحده (ما تطابقه).
  const memo = new Map<string, string>();
  const normOf = (r: IndexRow): string => {
    let n = memo.get(r.id);
    if (n === undefined) memo.set(r.id, (n = maskedSearchNorm(r)));
    return n;
  };
  // البحث يطابق أيضًا أسباب الأحكام ومنطوقها (ruling_segments، بلا سقف search_norm)، فعيّنة الاستعلام منهما كذلك:
  // اسم يرد بعد الحرف 20000 وحده (في التوقيع مثلًا) يُرى في العيّنة.
  const segs = await rulingSegmentsReady().catch(() => false);
  const segIds = segs
    ? `SELECT "ruling_id" FROM "ruling_segments" WHERE to_tsvector('simple', coalesce("part_norm",'')) @@ to_tsquery('simple', $1) AND "part" IN ('reasons','disposition')`
    : "";
  const [andTainted, phraseTainted] = await Promise.all([
    cached(`sa:${segs ? "s" : ""}:${andQ}`, async () => {
      const rows = await sampleRows(`${TSV} @@ to_tsquery('simple', $1)`, [andQ], true, segIds);
      return taintedBySample(rows, (r) => lexicalVisible(maskedMatchWords(r, normOf(r)), groups));
    }),
    phQ && phrase
      ? cached(`sp:${phQ}`, async () => {
          const rows = await sampleRows(`${TSV} @@ to_tsquery('simple', $1)`, [phQ]);
          // عيّنة العبارة الفارغة لا تشهد بشيء، فيبقى الحكم للعيّنة الأولى.
          if (!rows.length) return true;
          return taintedBySample(rows, (r) => phraseInWords(normWordList(normOf(r)), phrase));
        })
      : Promise.resolve(true),
  ]);
  return andTainted && phraseTainted;
}

/**
 * لفظ الحصر: عيّنة من الأحكام التي يطابقها نصه وحده (cond بمعاملاته، بلا أرقامه ولا مرشحات ولا مؤشر)، فلا يوجّه
 * رقمٌ في اللفظ العيّنةَ إلى قضية بعينها. term بلا أرقام، والمفتاح الشرط المطبّع نفسه.
 */
export async function enumerateTermTainted(term: EnumerateTerm, cond: string, params: unknown[]): Promise<boolean> {
  return cached(`e:${cond}\u0000${JSON.stringify(params)}`, async () => {
    const rows = await sampleRows(cond, params, term.sensitive);
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

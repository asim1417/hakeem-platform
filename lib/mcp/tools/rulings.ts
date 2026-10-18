/**
 * rulings.ts — أدوات الأحكام القضائية (v3): جلب حكم كامل مقطّعًا، وحصر شامل غير مسقوف.
 *
 * مُكيَّف على المخطط الفعلي: النموذج JudicialCase (جدول "judicial_cases")، ونصّ الحكم
 * في "judgmentText"، ورقم القضية decisionNo/caseNo، والمحكمة court، ولا عمود سنة هجرية
 * (تُشتقّ من decisionDateText). فهرس pg_trgm على judgmentText قائمٌ سلفًا
 * (idx_trgm_jc_text عبر scripts/apply-search-indexes.ts) — يسرّع ILIKE على ٥١ ألف حكم.
 */
import { prisma } from "@/lib/prisma";
import { extractHijriYear, runRulingSearchSql, splitRulingQuery } from "@/lib/modules/legal-core/rulings-search";
import { digitVariants, rulingNumbersSql, rulingRedactedTextSql } from "@/lib/modules/legal-core/ruling-redacted-sql";
import {
  enumeratePhrase,
  enumerateTermVisible,
  maskBySegments,
  maskRulingText,
  maskedSearchNorm,
  normWordList,
  phraseTsQuery,
  sliceMasked,
  termHasLetters,
  type EnumerateTerm,
} from "@/lib/mcp/ruling-privacy";
import { enumerateTermTainted } from "@/lib/mcp/name-taint";
import type { SegmentType } from "@/lib/rulings/research/segment";

/** السنة الهجرية من نصّ التاريخ (أرقام هندية أو لاتينية) — كان التعبير السابق يلتقط اللاتينية فقط. */
const hijriYear = (text?: string | null): number | null => extractHijriYear(text);

export const RULING_PARTS = ["header", "claims", "defense", "reasons", "disposition", "appeal", "other"] as const;
export type RulingPartName = (typeof RULING_PARTS)[number];

// ١) جلب نص حكم بمعرّفه مع تقطيع (offset/next_offset)، وخريطة أجزائه، وجلب جزء بعينه
//    (part = reasons للأسباب، disposition للمنطوق…) كي لا يقرأ النموذج الديباجة أولًا.
export async function getRuling(rulingId: string, offset = 0, maxChars = 30000, part?: RulingPartName) {
  const r = await prisma.judicialCase.findUnique({
    where: { id: rulingId },
    select: { id: true, caseNo: true, decisionNo: true, court: true, decisionDateText: true, judgmentText: true },
  });
  if (!r) return { error: "الحكم غير موجود بهذا المعرّف", ruling_id: rulingId };

  const full = r.judgmentText ?? "";
  // HKM-012 (الأمر ٠٨): الحجب قبل القص — يُحجب الحكم جزءًا جزءًا بحدود أجزائه في الخام (فلا يمحو الحجب
  // مراسي الأجزاء)، ثم تُقتطع الشريحة من المحجوب، فلا يفلت نصف اسم أو رقم على حد شريحة. كل الإزاحات في المحجوب.
  const { masked: maskedFull, parts: maskedParts } = maskBySegments(full);
  const parts = maskedParts.map((p) => ({ type: p.type as SegmentType, start: p.start, end: p.end }));
  // نطاق القراءة: الجزء المطلوب إن وُجد، وإلا النص كله.
  const target = part ? parts.find((p) => p.type === part) : undefined;
  if (part && !target) {
    return { ruling_id: r.id, error: `لم يُعثر على جزء «${part}» في هذا الحكم بالقواعد`, parts };
  }
  const lo = target?.start ?? 0;
  const hi = target?.end ?? maskedFull.length;
  const slice = sliceMasked(maskedFull.slice(lo, hi), offset, maxChars);

  return {
    ruling_id: r.id,
    case_number: r.decisionNo ?? r.caseNo ?? null,
    court: r.court ?? null,
    year_h: hijriYear(r.decisionDateText),
    total_chars: maskedFull.length,
    part: target?.type ?? null,
    parts, // خريطة الأجزاء بإزاحاتها في النص المحجوب
    offset: slice.offset, // داخل الجزء المطلوب (أو النص كله) بعد الحجب
    returned_chars: slice.text.length,
    next_offset: slice.nextOffset, // null = انتهى الجزء/النص
    text: slice.text, // HKM-012: الأرقام الشخصية وأسماء الأفراد محجوبة
  };
}

// ٢) حصر شامل غير مسقوف للأحكام (عدّ حقيقيّ + توزيع بالمحكمة + ترقيم keyset على id).
export async function enumerateRulings(
  terms: string[],
  court?: string,
  yearH?: number,
  countOnly = false,
  pageSize = 50,
  cursor?: string,
  snippetLen = 500,
): Promise<EnumBase | EnumPage> {
  // HKM-012: لا يُعثر على حكم بهوية أو جوال ولا بجزء منهما. الأرقام الطويلة تُطابَق في رقم القضية والقرار فقط؛
  // وما فيه رقم أو لاتيني على المتن المنقّح داخل القاعدة؛ والنص العربي الخالص عبارةً بكلمات كاملة (مع السوابق)
  // في فهرس search_norm — لا جزء كلمة («موس» لا تطابق «الموسوي»، و«نجش» لا تطابق «سونجشانج»).
  // NFKC أولًا: الأشكال المعروضة و«ﷲ» حروف عادية كما في النسخة المحجوبة.
  const split = terms.map((t) => splitRulingQuery(String(t ?? "").normalize("NFKC")));
  const prepared: EnumerateTerm[] = [];
  for (const p of split) {
    const phrase = p.text && !p.sensitive ? enumeratePhrase(p.text) : null;
    // لفظ لا يبقى منه بعد التطبيع كلمة ولا رقم («؟؟») لا يُحصر (كان يطابق الجدول كله).
    if (!p.numbers.length && !p.sensitive && !phrase) continue;
    prepared.push({ text: p.sensitive || phrase ? p.text : "", numbers: p.numbers, sensitive: p.sensitive, phrase });
  }
  terms = prepared.map((t) => [t.text, ...t.numbers].filter(Boolean).join(" "));
  const filtersOut = { court: court ?? null, year_h: yearH ?? null };
  const size = Math.max(1, Math.floor(pageSize));
  const empty = (): EnumBase | EnumPage => {
    const base: EnumBase = { terms, filters: filtersOut, total: 0, by_court: [] };
    return countOnly ? base : { ...base, page_size: pageSize, returned: 0, next_cursor: null, results: [] };
  };
  if (!prepared.length) return empty();

  // شرط كل لفظ (بمعاملاته): الأرقام في رقم القضية والقرار، والحساس في العنوان والمتن المنقّحين، والعبارة في فهرس
  // search_norm (GIN على to_tsvector('simple')).
  const termCond = (t: EnumerateTerm, params: unknown[]): string => {
    const conds = rulingNumbersSql(t.numbers, params, "r.");
    if (t.text && t.sensitive) conds.push(rulingRedactedTextSql(t.text, params, "r.", { appeal: false }));
    else if (t.phrase) {
      params.push(phraseTsQuery(t.phrase));
      conds.push(`to_tsvector('simple', coalesce(r."search_norm",'')) @@ to_tsquery('simple', $${params.length})`);
    }
    return `(${conds.join(" AND ")})`;
  };

  // HKM-012: اللفظ الذي فيه حرف ويطابق داخل أسماء الأفراد غالبًا (عيّنة من أحكامه وحده، بلا مرشحات ولا مؤشر)
  // لا يطابق شيئًا: يخرج من العدد والتوزيع والصفحة، فلا يختلف المخرج عن لفظ غائب عن القاعدة.
  const tainted = await Promise.all(
    prepared.map((t) => {
      if (!termHasLetters(t)) return Promise.resolve(false);
      const tp: unknown[] = [];
      return enumerateTermTainted(t, termCond(t, tp), tp);
    }),
  );
  const kept = prepared.filter((_, i) => !tainted[i]);
  if (!kept.length) return empty();

  const params: unknown[] = [];
  const filters: string[] = [`(${kept.map((t) => termCond(t, params)).join(" OR ")})`];
  if (court) {
    params.push(`%${court}%`);
    filters.push(`r."court" ILIKE $${params.length}`);
  }
  // لا عمود سنة هجرية — تقريبٌ بمطابقة نصّ التاريخ (تُشتقّ السنة في المخرجات). التاريخ مخزَّن بالأرقام
  // الهندية، فتُطابَق الصيغتان (كانت اللاتينية وحدها لا تجد شيئًا).
  if (yearH) {
    const conds = digitVariants(String(yearH)).map((v) => {
      params.push(`%${v}%`);
      return `r."decisionDateText" ILIKE $${params.length}`;
    });
    filters.push(`(${conds.join(" OR ")})`);
  }
  const whereSql = filters.join(" AND ");

  /** يُعاد الحكم إن طابقه لفظ باقٍ على نسخته المحجوبة بباني الإنتاج؛ وما سواه لا يُعاد ولا يُعدّ في العدد الصغير. */
  const visible = (r: EnumRow): boolean => {
    let words: string[] | null = null;
    let titleText: string | null = null;
    return kept.some((t) =>
      enumerateTermVisible(t, {
        maskedWords: () => (words ??= normWordList(maskedSearchNorm(r))),
        maskedTitleText: () => (titleText ??= `${maskRulingText(r.judgmentTitle)}\n${maskRulingText(r.judgmentText)}`),
        caseNo: r.caseNo,
        decisionNo: r.decisionNo,
      }),
    );
  };
  const readRows = (ids: string[]) =>
    ids.length
      ? prisma.$queryRawUnsafe<EnumRow[]>(`SELECT ${ROW_FIELDS} FROM "judicial_cases" r WHERE r."id" = ANY($1::text[]) ORDER BY r."id" ASC`, ids)
      : Promise.resolve([] as EnumRow[]);

  // الاستعلامات على فهرس search_norm (GIN) والمسح التسلسلي معطّل في معاملتها (كما في البحث)؛ والمرتبة بالمعرّف تجمع
  // المعرّفات المطابقة من الفهرس أولًا (MATERIALIZED) فلا يمشي المخطِّط على المفتاح الأساسي حاسبًا tsvector لكل صف.
  const run = <T>(sql: string, p: unknown[]) => runRulingSearchSql<T>(sql, p, true);
  const matched = `WITH m AS MATERIALIZED (SELECT r."id" FROM "judicial_cases" r WHERE ${whereSql})`;
  const [totalRows, byCourtRows, idRows] = await Promise.all([
    run<{ n: bigint }[]>(`SELECT COUNT(*)::bigint AS n FROM "judicial_cases" r WHERE ${whereSql}`, params),
    run<{ court: string | null; n: bigint }[]>(
      `SELECT r."court" AS court, COUNT(*)::bigint AS n FROM "judicial_cases" r WHERE ${whereSql} GROUP BY r."court" ORDER BY n DESC`,
      params,
    ),
    countOnly
      ? Promise.resolve([] as Array<{ id: string }>)
      : run<Array<{ id: string }>>(
          `${matched} SELECT "id" FROM m${cursor ? ` WHERE "id" > $${params.length + 1}` : ""} ORDER BY "id" ASC LIMIT ${SCAN_CAP}`,
          cursor ? [...params, cursor] : params,
        ),
  ]);
  const dbTotal = Number(totalRows[0]?.n ?? 0);

  // العدد الصغير يُحسب من المرئي نفسه: خلية صغيرة (محكمة/سنة) فيها حكم لا يطابق إلا داخل اسم لا تكشفه.
  // وفوق ذلك عدد القاعدة، وتُضم المحاكم التي عددها دون SMALL_BUCKET إلى «أخرى».
  let total = dbTotal;
  let byCourt: Array<{ court: string | null; count: number }>;
  let smallVisible: EnumRow[] | null = null;
  if (dbTotal > 0 && dbTotal < SMALL_TOTAL) {
    const all = await run<EnumRow[]>(
      `${matched} SELECT ${ROW_FIELDS} FROM "judicial_cases" r JOIN (SELECT "id" FROM m ORDER BY "id" LIMIT ${SMALL_TOTAL}) s ON s."id" = r."id" ORDER BY r."id" ASC`,
      params,
    );
    smallVisible = all.filter(visible);
    total = smallVisible.length;
    const m = new Map<string | null, number>();
    for (const r of smallVisible) m.set(r.court, (m.get(r.court) ?? 0) + 1);
    byCourt = [...m.entries()].sort((a, b) => b[1] - a[1]).map(([c, count]) => ({ court: c, count }));
  } else {
    const big = byCourtRows.map((c) => ({ court: c.court, count: Number(c.n) })).filter((c) => c.count >= SMALL_BUCKET);
    const rest = byCourtRows.reduce((acc, c) => acc + (Number(c.n) < SMALL_BUCKET ? Number(c.n) : 0), 0);
    byCourt = [...big.slice(0, 30), ...(rest > 0 ? [{ court: OTHER_COURTS, count: rest }] : [])];
  }
  const base: EnumBase = { terms, filters: filtersOut, total, by_court: byCourt };
  if (countOnly) return base;

  // الصفحة: من المعرّفات المطابقة بعد المؤشر (حتى SCAN_CAP) تُقرأ دفعات ويُعاد المرئي منها؛ والمؤشر آخر صف معروض
  // فقط، فلا يُكشف معرّف صف لم يُعَد، ولا تنقلب صفحة عند صف مسقط قبل SCAN_CAP صفًّا مسقطًا متتاليًا.
  const results: EnumResult[] = [];
  let lastReturned: string | null = null;
  const toResult = (r: EnumRow): EnumResult => {
    // الحجب قبل القص، فلا يقطع القصُّ رقمًا أو اسمًا يفلت من الحجب (HKM-012: والأسماء).
    const txt = maskRulingText(r.judgmentText);
    // مقتطف حول أول لفظ مطابق (لا صدر الحكم) — للغرض التصنيفي (سياق اللفظ).
    let idx = -1;
    for (const t of kept.map((k) => k.text).filter(Boolean)) {
      const i = txt.indexOf(t);
      if (i !== -1 && (idx === -1 || i < idx)) idx = i;
    }
    const start = Math.max(0, idx - Math.floor(snippetLen / 2));
    return {
      ruling_id: r.id,
      case_number: r.decisionNo ?? r.caseNo ?? null,
      court: r.court,
      year_h: hijriYear(r.decisionDateText),
      match_offset: idx === -1 ? null : idx,
      snippet: idx === -1 ? txt.slice(0, snippetLen) : txt.slice(start, start + snippetLen),
    };
  };
  const ids = idRows.map((x) => x.id);
  for (let i = 0; i < ids.length && results.length < size; i += READ_BATCH) {
    for (const r of await readRows(ids.slice(i, i + READ_BATCH))) {
      if (results.length >= size) break;
      if (!visible(r)) continue;
      results.push(toResult(r));
      lastReturned = r.id;
    }
  }
  // امتلأت الصفحة، أو بلغ المسح سقفه وبعده غيره: يُتابع من آخر صف معروض. وإلا انتهت المطابقات.
  const more = results.length >= size ? lastReturned !== ids[ids.length - 1] || ids.length === SCAN_CAP : ids.length === SCAN_CAP;
  const nextCursor = lastReturned !== null && more ? lastReturned : null;

  return { ...base, page_size: pageSize, returned: results.length, next_cursor: nextCursor, results };
}

/** سقف المعرّفات المقروءة بعد المؤشر في النداء الواحد، ودفعة قراءة النصوص. */
const SCAN_CAP = 1000;
const READ_BATCH = 50;
/** العدد دون هذا يُحسب من المرئي؛ والمحكمة دون هذا تُضم إلى «أخرى». */
const SMALL_TOTAL = 50;
const SMALL_BUCKET = 5;
const OTHER_COURTS = "أخرى (أقل من ٥ لكل محكمة)";
const ROW_FIELDS = `r."id", r."court", r."judgmentTitle", r."judgmentText", r."appealText", r."caseNo", r."decisionNo", r."cityName", r."decisionDateText"`;

type EnumRow = {
  id: string;
  court: string | null;
  judgmentTitle: string | null;
  judgmentText: string;
  appealText: string | null;
  caseNo: string | null;
  decisionNo: string | null;
  cityName: string | null;
  decisionDateText: string | null;
};
type EnumBase = {
  terms: string[];
  filters: { court: string | null; year_h: number | null };
  total: number;
  by_court: Array<{ court: string | null; count: number }>;
};
type EnumPage = EnumBase & { page_size: number; returned: number; next_cursor: string | null; results: EnumResult[] };
type EnumResult = {
  ruling_id: string;
  case_number: string | null;
  court: string | null;
  year_h: number | null;
  match_offset: number | null;
  snippet: string;
};

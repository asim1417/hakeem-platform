/**
 * rulings.ts — أدوات الأحكام القضائية (v3): جلب حكم كامل مقطّعًا، وحصر شامل بترقيم غير مسقوف.
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

// ٢) حصر شامل للأحكام (عدّ + توزيع بالمحكمة + ترقيم keyset على id بلا سقف).
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
  // NFKC للاستعلام: الأشكال المعروضة حروف عادية.
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
  if (!prepared.length) {
    const base: EnumBase = { terms, filters: filtersOut, total: 0, total_is_lower_bound: false, by_court: [] };
    return countOnly ? base : { ...base, page_size: pageSize, returned: 0, next_cursor: null, results: [] };
  }

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

  // HKM-012: اللفظ الذي فيه حرف ويطابق نصُّه داخل أسماء الأفراد غالبًا (عيّنة من أحكام نصه وحده، بلا أرقامه ولا مرشحات
  // ولا مؤشر، فلا يوجّهها رقم إلى قضية بعينها) شرطه FALSE. ولا عودة مبكرة: الاستعلامات نفسها تجري كما للفظ غائب،
  // فلا يكشف عددها أنه اسم. (وزمن المسح يتبع عدد المطابقات في القاعدة لكل لفظ؛ يزول بالحل الجذري.)
  const tainted = await Promise.all(
    prepared.map((t) => {
      if (!termHasLetters(t)) return Promise.resolve(false);
      const textOnly: EnumerateTerm = { ...t, numbers: [] };
      const tp: unknown[] = [];
      return enumerateTermTainted(textOnly, termCond(textOnly, tp), tp);
    }),
  );
  const kept = prepared.filter((_, i) => !tainted[i]);

  // مرشحا المحكمة والسنة (بمعاملاتهما). لا عمود سنة هجرية — تقريبٌ بمطابقة نصّ التاريخ (تُشتقّ السنة في المخرجات).
  // التاريخ مخزَّن بالأرقام الهندية، فتُطابَق الصيغتان (كانت اللاتينية وحدها لا تجد شيئًا).
  const filterConds = (p: unknown[]): string[] => {
    const out: string[] = [];
    if (court) {
      p.push(`%${court}%`);
      out.push(`r."court" ILIKE $${p.length}`);
    }
    if (yearH) {
      const conds = digitVariants(String(yearH)).map((v) => {
        p.push(`%${v}%`);
        return `r."decisionDateText" ILIKE $${p.length}`;
      });
      out.push(`(${conds.join(" OR ")})`);
    }
    return out;
  };
  const params: unknown[] = [];
  const filters: string[] = [`(${prepared.map((t, i) => (tainted[i] ? "FALSE" : termCond(t, params))).join(" OR ")})`, ...filterConds(params)];
  const whereSql = filters.join(" AND ");

  /** يُعاد الحكم ويُعدّ إن طابقه لفظ باقٍ على نسخته المحجوبة بباني الإنتاج؛ وما سواه لا يُعاد ولا يُعدّ. */
  const visible = (r: EnumRow, pre?: { words: string[]; titleText: string }): boolean => {
    let words: string[] | null = pre?.words ?? null;
    let titleText: string | null = pre?.titleText ?? null;
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

  /**
   * الأحكام الظاهرة بعد المؤشر بترتيب المعرّف: تُقرأ المطابقات دفعات حتى want صفًّا ظاهرًا أو SCAN_CAP معرّفًا.
   * exhausted: قُرئت كل المطابقات بعد المؤشر.
   */
  const scanVisible = async (after: string | null, want: number): Promise<{ rows: EnumRow[]; exhausted: boolean }> => {
    const idRows = await run<Array<{ id: string }>>(
      `${matched} SELECT "id" FROM m${after ? ` WHERE "id" > $${params.length + 1}` : ""} ORDER BY "id" ASC LIMIT ${SCAN_CAP + 1}`,
      after ? [...params, after] : params,
    );
    const ids = idRows.map((x) => x.id);
    const budget = Math.min(ids.length, SCAN_CAP);
    const rows: EnumRow[] = [];
    let scanned = 0;
    while (scanned < budget && rows.length < want) {
      const batch = ids.slice(scanned, Math.min(scanned + READ_BATCH, budget));
      scanned += batch.length;
      for (const r of await readRows(batch)) if (visible(r)) rows.push(r);
    }
    return { rows, exhausted: scanned >= ids.length };
  };

  // العدد والتوزيع.
  // - ألفاظ بلا حرف (رقم القضية أو القرار، أو نص أرقام): لا يمسّها حجب الأسماء، فمن القاعدة كاملًا.
  // - لفظ فيه حرف: من الأحكام الظاهرة وحدها، على مسح مسقوف بترتيب المعرّف. عدد القاعدة يشمل أحكامًا لا تطابق إلا
  //   داخل اسم، فيُستخرج منه بالفرق أو بالشمول والاستبعاد عدد أحكام الاسم. يُعدّ حتى COUNT_CAP حكمًا ظاهرًا في أول
  //   SCAN_CAP مطابقة، وtotal_is_lower_bound بلوغ السقف وحده (ولا يزيد الرقم عليه، فلا يكشف موضع الدفعة عدد المسقط
  //   فيها). ولا يعكس العلم بلوغ المسح حده: كان يميّز الخلية التي تكثر فيها المطابقات داخل الأسماء. والصفحات بلا سقف.
  //   الوضع يُحدَّد بالألفاظ قبل الفحص، فلا يختلف مسار لفظ اسم عن لفظ غائب.
  const lettersMode = prepared.some(termHasLetters);
  let base: EnumBase;
  let head: { rows: EnumRow[]; exhausted: boolean } | null = null;
  if (!lettersMode) {
    const [totalRows, byCourtRows] = await Promise.all([
      run<{ n: bigint }[]>(`SELECT COUNT(*)::bigint AS n FROM "judicial_cases" r WHERE ${whereSql}`, params),
      run<{ court: string | null; n: bigint }[]>(
        `SELECT r."court" AS court, COUNT(*)::bigint AS n FROM "judicial_cases" r WHERE ${whereSql} GROUP BY r."court" ORDER BY n DESC LIMIT 30`,
        params,
      ),
    ]);
    base = {
      terms,
      filters: filtersOut,
      total: Number(totalRows[0]?.n ?? 0),
      total_is_lower_bound: false,
      by_court: byCourtRows.map((c) => ({ court: c.court, count: Number(c.n) })),
    };
  } else {
    // المفتاح من شروط الألفاظ كلها قبل إبدال لفظ الاسم بـ FALSE، ومعه علم التلوث والمرشحات: لو بُني بعد الإبدال
    // لاشترك كل لفظَي اسم بالمرشحات نفسها في مفتاح، فيكشف الحفظُ (بالزمن) أن الاسم الثاني في القاعدة.
    const keyParams: unknown[] = [];
    const keyConds = prepared.map((t) => termCond(t, keyParams));
    const key = JSON.stringify([keyConds, keyParams, tainted, court ?? null, yearH ?? null]);
    let counted = countCacheGet(key);
    if (!counted) {
      // حتى COUNT_CAP+1 ظاهرًا: السقف يُعرف بوجود ظاهر بعده، لا ببقاء معرّفات لم تُقرأ (قد تكون أحكام أسماء).
      head = await scanVisible(null, COUNT_CAP + 1);
      const capped = head.rows.length > COUNT_CAP;
      const rows = head.rows.slice(0, COUNT_CAP);
      const m = new Map<string | null, number>();
      for (const r of rows) m.set(r.court, (m.get(r.court) ?? 0) + 1);
      counted = {
        total: rows.length,
        lowerBound: capped,
        byCourt: [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([c, count]) => ({ court: c, count })),
      };
      countCacheSet(key, counted);
    }
    base = { terms, filters: filtersOut, total: counted.total, total_is_lower_bound: counted.lowerBound, by_court: counted.byCourt };
  }
  if (countOnly) return base;

  // الصفحة: من المعرّفات المطابقة بعد المؤشر تُقرأ دفعات ويُعاد الظاهر منها. والمؤشر آخر صف معروض متى كانت الصفحة
  // غير فارغة، فيُختم كل حصر بصفحة فارغة بلا مؤشر: لا يكشف وجود المؤشر ولا خلو الصفحة التالية أن بعد آخر صف معروض
  // أحكامًا مسقطة، ولا أن المسح بلغ حده. ولا يُكشف معرّف صف لم يُعَد.
  // المؤشر يُقبل إن كان حكمًا يطابقه الاستعلام نفسه ويظهر فيه (كما يُعاد)، وإلا فالصفحة فارغة كنهاية الحصر: مؤشر
  // حر كان يُستخرج به بالتنصيف معرّف حكم مسقط. والعمل واحد لكل مؤشر أيًّا كانت الألفاظ: شروطها الأصلية كلها (قبل
  // إبدال لفظ الاسم) تُحسب على صفه، ويُحجب بالصيغتين ولو لم يطابق؛ فلا يكشف زمنه أن اللفظ اسم.
  if (cursor) {
    // معاملات خاصة بهذا الاستعلام: كل معامل مذكور فيه (لا معاملات زائدة لا يُعرف نوعها).
    const cp: unknown[] = [];
    const flags = prepared.map((t, i) => `${termCond(t, cp)} AS "t${i}"`).join(", ");
    const fc = filterConds(cp);
    const filterSql = fc.length ? fc.join(" AND ") : "TRUE";
    cp.push(cursor);
    const at = await run<Array<EnumRow & Record<string, unknown>>>(
      `SELECT ${ROW_FIELDS}, ${flags}, (${filterSql}) AS "f" FROM "judicial_cases" r WHERE r."id" = $${cp.length}`,
      cp,
    );
    const row = at[0];
    let shown = false;
    if (row) {
      const pre = { words: normWordList(maskedSearchNorm(row)), titleText: `${maskRulingText(row.judgmentTitle)}\n${maskRulingText(row.judgmentText)}` };
      shown = visible(row, pre);
    }
    const matched = Boolean(row) && row.f === true && prepared.some((_, i) => !tainted[i] && row[`t${i}`] === true);
    if (!matched || !shown) return { ...base, page_size: pageSize, returned: 0, next_cursor: null, results: [] };
  }
  const scan = !cursor && head ? head : await scanVisible(cursor || null, size);
  const pageRows = scan.rows.slice(0, size);
  const nextCursor = pageRows.length ? pageRows[pageRows.length - 1].id : null;
  const results = pageRows.map((r): EnumResult => {
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
  });

  return { ...base, page_size: pageSize, returned: results.length, next_cursor: nextCursor, results };
}

/** سقف المعرّفات المقروءة بعد المؤشر في النداء الواحد، ودفعة قراءة النصوص. */
const SCAN_CAP = 600;
const READ_BATCH = 50;
/** سقف عدّ الأحكام الظاهرة للفظ فيه حرف (وما فوقه total_is_lower_bound). */
const COUNT_CAP = 200;
const ROW_FIELDS = `r."id", r."court", r."judgmentTitle", r."judgmentText", r."appealText", r."caseNo", r."decisionNo", r."cityName", r."decisionDateText"`;

/** عدّ الظاهر محفوظ عشر دقائق بالشرط نفسه، فلا يُعاد المسح مع كل صفحة. */
type Counted = { total: number; lowerBound: boolean; byCourt: Array<{ court: string | null; count: number }> };
const COUNT_TTL_MS = 10 * 60_000;
const COUNT_MAX = 500;
const countCache = new Map<string, { v: Counted; at: number }>();
function countCacheGet(key: string): Counted | null {
  const hit = countCache.get(key);
  return hit && Date.now() - hit.at < COUNT_TTL_MS ? hit.v : null;
}
function countCacheSet(key: string, v: Counted): void {
  if (countCache.size >= COUNT_MAX) countCache.delete(countCache.keys().next().value as string);
  countCache.set(key, { v, at: Date.now() });
}
/** للاختبار: يفرغ حفظ العدّ. */
export function clearEnumerateCountCache(): void {
  countCache.clear();
}

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
  total_is_lower_bound: boolean;
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

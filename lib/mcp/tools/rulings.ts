/**
 * rulings.ts — أدوات الأحكام القضائية (v3): جلب حكم كامل مقطّعًا، وحصر شامل غير مسقوف.
 *
 * مُكيَّف على المخطط الفعلي: النموذج JudicialCase (جدول "judicial_cases")، ونصّ الحكم
 * في "judgmentText"، ورقم القضية decisionNo/caseNo، والمحكمة court، ولا عمود سنة هجرية
 * (تُشتقّ من decisionDateText). فهرس pg_trgm على judgmentText قائمٌ سلفًا
 * (idx_trgm_jc_text عبر scripts/apply-search-indexes.ts) — يسرّع ILIKE على ٥١ ألف حكم.
 */
import { prisma } from "@/lib/prisma";
import { normalizeArabic } from "@/lib/modules/legal-core/bm25-tokenizer";
import { extractHijriYear, splitRulingQuery } from "@/lib/modules/legal-core/rulings-search";
import { digitVariants, rulingNumbersSql, rulingRedactedTextSql } from "@/lib/modules/legal-core/ruling-redacted-sql";
import {
  enumerateTermVisible,
  maskBySegments,
  maskRulingText,
  maskedSearchNorm,
  sliceMasked,
  termIsArabic,
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
  // HKM-012: لا يُعثر على حكم بهوية أو جوال ولا بجزء منهما. الأرقام الطويلة تُطابَق في رقم القضية
  // والقرار فقط؛ اللفظ العربي الخالص في search_norm؛ وما فيه رقم أو لاتيني على المتن المنقّح داخل القاعدة،
  // لأن search_norm قد يحمل بقايا محجوب لا ينظّفها #704.
  const parts = terms.map((t) => splitRulingQuery(t)).filter((p) => p.text || p.numbers.length);
  terms = parts.map((p) => [p.text, ...p.numbers].filter(Boolean).join(" "));
  const filtersOut = { court: court ?? null, year_h: yearH ?? null };
  const size = Math.max(1, Math.floor(pageSize));
  const empty = (): EnumBase | EnumPage => {
    const base: EnumBase = { terms, filters: filtersOut, total: 0, by_court: [] };
    return countOnly ? base : { ...base, page_size: pageSize, returned: 0, next_cursor: null, results: [] };
  };
  if (!parts.length) return empty();

  // شرط كل لفظ (بمعاملاته). search_norm (المحكمة والعنوان والمتن والاستئناف والرقمان والمدينة) للعربي الخالص،
  // والعنوان والمتن المنقّحان للحساس.
  const termCond = (p: (typeof parts)[number], params: unknown[]): string => {
    const conds = rulingNumbersSql(p.numbers, params, "r.");
    if (p.text && p.sensitive) conds.push(rulingRedactedTextSql(p.text, params, "r.", { appeal: false }));
    else if (p.text) {
      // تعقيم أحرف بدل ILIKE (% _ \) ثمّ تغليف بـ %..% — بمعاملات مربوطة (بلا حقن).
      params.push(`%${normalizeArabic(p.text).replace(/[%_\\]/g, "")}%`);
      conds.push(`r."search_norm" ILIKE $${params.length}`);
    }
    return `(${conds.join(" AND ")})`;
  };
  const enumTerms: EnumerateTerm[] = parts.map((p) => ({ text: p.text, numbers: p.numbers, sensitive: p.sensitive }));

  // HKM-012: اللفظ العربي الذي يطابق داخل أسماء الأفراد غالبًا (عيّنة من أحكامه وحده، بلا مرشحات ولا مؤشر)
  // لا يطابق شيئًا: يخرج من العدد والتوزيع والصفحة، فلا يختلف المخرج عن لفظ غائب عن القاعدة.
  const taintQ = Promise.all(
    parts.map((p, i) => {
      if (!termIsArabic(enumTerms[i])) return Promise.resolve(false);
      const tp: unknown[] = [];
      return enumerateTermTainted(enumTerms[i], termCond(p, tp), tp);
    }),
  );

  const params: unknown[] = [];
  const termConds = parts.map((p) => termCond(p, params));
  // بت لكل لفظ يطابق الحكم، فيُحسب العدد والتوزيع لأي مجموعة من الألفاظ من مسح واحد.
  const maskExpr = termConds.map((c, i) => `(CASE WHEN ${c} THEN ${2 ** i} ELSE 0 END)`).join(" + ");
  const filters: string[] = [`(${termConds.join(" OR ")})`];
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

  const aggQ = prisma.$queryRawUnsafe<Array<{ court: string | null; m: number; n: bigint }>>(
    `SELECT r."court" AS court, (${maskExpr})::int AS m, COUNT(*)::bigint AS n
     FROM "judicial_cases" r WHERE ${whereSql}
     GROUP BY 1, 2`,
    ...params,
  );
  // نافذة الصفحة: ضعف حجمها، فيُكمل ما أُسقط منها؛ والمؤشر داخلي (آخر صف مقروء) لا يُعاد إلا إن كان صفًّا معروضًا.
  const windowSize = Math.min(size * 2, 200);
  const readWindow = (after: string | undefined, onlyMask: number | null) => {
    const wp = [...params];
    let extra = "";
    if (onlyMask !== null) extra += ` AND ((${maskExpr})::int & ${onlyMask}) <> 0`;
    if (after) {
      wp.push(after);
      extra += ` AND r."id" > $${wp.length}`;
    }
    return prisma.$queryRawUnsafe<Array<EnumRow & { m: number }>>(
      `SELECT r."id", r."court", r."judgmentTitle", r."judgmentText", r."appealText", r."caseNo", r."decisionNo", r."cityName",
              r."decisionDateText", (${maskExpr})::int AS m
       FROM "judicial_cases" r WHERE ${whereSql}${extra}
       ORDER BY r."id" ASC LIMIT ${windowSize}`,
      ...wp,
    );
  };
  const [tainted, agg, firstWindow] = await Promise.all([taintQ, aggQ, countOnly ? Promise.resolve([]) : readWindow(cursor, null)]);

  const keep = tainted.reduce((acc, t, i) => (t ? acc : acc | (2 ** i)), 0);
  if (keep === 0) return empty();

  let total = 0;
  const courts = new Map<string | null, number>();
  for (const a of agg) {
    if ((Number(a.m) & keep) === 0) continue;
    const n = Number(a.n);
    total += n;
    courts.set(a.court, (courts.get(a.court) ?? 0) + n);
  }
  const base: EnumBase = {
    terms,
    filters: filtersOut,
    total,
    by_court: [...courts.entries()].sort((x, y) => y[1] - x[1]).slice(0, 30).map(([c, count]) => ({ court: c, count })),
  };
  if (countOnly) return base;

  // الصفحة: صف يطابقه لفظ باقٍ على نسخته المحجوبة بباني الإنتاج؛ وما سواه لا يُعاد ولا يُكشف معرّفه.
  const results: EnumResult[] = [];
  let lastReturned: string | null = null;
  let window = firstWindow;
  let more = true;
  for (let w = 0; w < 3 && results.length < size; w++) {
    if (w > 0) {
      if (!more || !window.length) break;
      window = await readWindow(window[window.length - 1].id, keep);
    }
    more = window.length === windowSize;
    for (const r of window) {
      if (results.length >= size) break;
      const m = Number(r.m) & keep;
      if (m === 0) continue;
      const maskedNorm = maskedSearchNorm(r);
      let title: string | null = null;
      const visible = enumTerms.some(
        (t, i) =>
          (m & (2 ** i)) !== 0 &&
          enumerateTermVisible(t, {
            maskedNorm,
            maskedTitleText: () => `${(title ??= maskRulingText(r.judgmentTitle))}\n${maskRulingText(r.judgmentText)}`,
            caseNo: r.caseNo,
            decisionNo: r.decisionNo,
          }),
      );
      if (!visible) continue;
      // الحجب قبل القص، فلا يقطع القصُّ رقمًا أو اسمًا يفلت من الحجب (HKM-012: والأسماء).
      const txt = maskRulingText(r.judgmentText);
      // مقتطف حول أول لفظ مطابق (لا صدر الحكم) — للغرض التصنيفي (سياق اللفظ).
      let idx = -1;
      for (const t of parts.map((p) => p.text).filter(Boolean)) {
        const i = txt.indexOf(t);
        if (i !== -1 && (idx === -1 || i < idx)) idx = i;
      }
      const start = Math.max(0, idx - Math.floor(snippetLen / 2));
      results.push({
        ruling_id: r.id,
        case_number: r.decisionNo ?? r.caseNo ?? null,
        court: r.court,
        year_h: hijriYear(r.decisionDateText),
        match_offset: idx === -1 ? null : idx,
        snippet: idx === -1 ? txt.slice(0, snippetLen) : txt.slice(start, start + snippetLen),
      });
      lastReturned = r.id;
    }
    // الصفحة امتلأت قبل آخر النافذة: الباقي يُقرأ في النداء التالي من آخر صف معروض.
    if (results.length >= size) break;
  }
  // المؤشر آخر صف معروض فقط (صف لم يُعَد لا يُكشف معرّفه)؛ ولا مؤشر إن لم يُعَد شيء أو انتهت المطابقات.
  const nextCursor = lastReturned !== null && (results.length >= size || more) ? lastReturned : null;

  return { ...base, page_size: pageSize, returned: results.length, next_cursor: nextCursor, results };
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

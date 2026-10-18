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
import { enumerateMatchOnlyInNames, maskBySegments, maskRulingText, sliceMasked, type EnumerateTerm } from "@/lib/mcp/ruling-privacy";
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
) {
  // HKM-012: لا يُعثر على حكم بهوية أو جوال ولا بجزء منهما. الأرقام الطويلة تُطابَق في رقم القضية
  // والقرار فقط؛ اللفظ العربي الخالص في search_norm (الحجب لا يمسّه)؛ وما فيه رقم أو لاتيني على
  // المتن المنقّح داخل القاعدة، لأن search_norm قد يحمل بقايا محجوب لا ينظّفها #704.
  const parts = terms.map((t) => splitRulingQuery(t)).filter((p) => p.text || p.numbers.length);
  terms = parts.map((p) => [p.text, ...p.numbers].filter(Boolean).join(" "));
  if (!parts.length) {
    const empty = { terms, filters: { court: court ?? null, year_h: yearH ?? null }, total: 0, by_court: [] };
    return countOnly ? empty : { ...empty, page_size: pageSize, returned: 0, next_cursor: null, results: [] };
  }
  const params: unknown[] = [];
  const termConds = parts.map((p) => {
    const conds = rulingNumbersSql(p.numbers, params, "r.");
    // العنوان والمتن كما في search_norm (لا الاستئناف).
    if (p.text && p.sensitive) conds.push(rulingRedactedTextSql(p.text, params, "r.", { appeal: false }));
    else if (p.text) {
      // تعقيم أحرف بدل ILIKE (% _ \) ثمّ تغليف بـ %..% — بمعاملات مربوطة (بلا حقن).
      params.push(`%${normalizeArabic(p.text).replace(/[%_\\]/g, "")}%`);
      conds.push(`r."search_norm" ILIKE $${params.length}`);
    }
    return `(${conds.join(" AND ")})`;
  });
  const filters: string[] = [`(${termConds.join(" OR ")})`];
  if (court) {
    params.push(`%${court}%`);
    filters.push(`r."court" ILIKE $${params.length}`);
  }
  // لا عمود سنة هجرية — تقريبٌ بمطابقة نصّ التاريخ (تُشتقّ السنة في المخرجات). التاريخ مخزَّن بالأرقام
  // الهندية غالبًا، فتُطابَق الصيغتان (كانت اللاتينية وحدها لا تجد شيئًا).
  if (yearH) {
    const conds = digitVariants(String(yearH)).map((v) => {
      params.push(`%${v}%`);
      return `r."decisionDateText" ILIKE $${params.length}`;
    });
    filters.push(`(${conds.join(" OR ")})`);
  }
  const whereSql = filters.join(" AND ");

  // الصفحة تُجلب دائمًا (ولو count_only): بها يُتحقق ألا تكون المطابقة داخل اسم محجوب. الاستعلامات الثلاثة
  // متوازية (كل منها مسح لـ search_norm بلا فهرس احتواء، فتسلسلها كان يتجاوز مهلة الأداة).
  const pageParams = cursor && !countOnly ? [...params, cursor] : params;
  const pageFilters = cursor && !countOnly ? `${whereSql} AND r."id" > $${pageParams.length}` : whereSql;
  const size = Math.max(1, Math.floor(pageSize));
  const [totalRows, byCourt, rows] = await Promise.all([
    prisma.$queryRawUnsafe<{ n: bigint }[]>(`SELECT COUNT(*)::bigint AS n FROM "judicial_cases" r WHERE ${whereSql}`, ...params),
    prisma.$queryRawUnsafe<{ court: string | null; n: bigint }[]>(
      `SELECT r."court" AS court, COUNT(*)::bigint AS n
     FROM "judicial_cases" r WHERE ${whereSql}
     GROUP BY r."court" ORDER BY n DESC LIMIT 30`,
      ...params,
    ),
    prisma.$queryRawUnsafe<
      Array<{ id: string; caseNo: string | null; decisionNo: string | null; court: string | null; decisionDateText: string | null; judgmentTitle: string | null; judgmentText: string }>
    >(
      `SELECT r."id", r."caseNo", r."decisionNo", r."court", r."decisionDateText", r."judgmentTitle", r."judgmentText"
     FROM "judicial_cases" r WHERE ${pageFilters}
     ORDER BY r."id" ASC LIMIT ${size}`,
      ...pageParams,
    ),
  ]);
  const total = Number(totalRows[0]?.n ?? 0);

  // HKM-012: الحكم الذي لا يطابقه لفظ إلا داخل اسم محجوب لا يُعاد. وإن أُسقط شيء فالإجمالي والتوزيع من
  // الصفحة وحدها (counts_page_only)، فلا يكشف عددُ القاعدة عددَ أحكام اسمٍ.
  const enumTerms: EnumerateTerm[] = parts.map((p) => ({ text: p.text, numbers: p.numbers, sensitive: p.sensitive }));
  let withheld = 0;
  const results: Array<{ ruling_id: string; case_number: string | null; court: string | null; year_h: number | null; match_offset: number | null; snippet: string }> = [];
  for (const r of rows) {
    // الحجب قبل القص، فلا يقطع القصُّ رقمًا أو اسمًا يفلت من الحجب (HKM-012: والأسماء).
    const txt = maskRulingText(r.judgmentText);
    const maskedTitle = maskRulingText(r.judgmentTitle);
    if (enumerateMatchOnlyInNames({ title: r.judgmentTitle, text: r.judgmentText, maskedTitle, maskedText: txt, caseNo: r.caseNo, decisionNo: r.decisionNo }, enumTerms)) {
      withheld++;
      continue;
    }
    // مقتطف حول أول لفظ مطابق (لا صدر الحكم) — للغرض التصنيفي (سياق اللفظ).
    let idx = -1;
    for (const t of parts.map((p) => p.text).filter(Boolean)) {
      const i = txt.indexOf(t);
      if (i !== -1 && (idx === -1 || i < idx)) idx = i;
    }
    const start = Math.max(0, idx - Math.floor(snippetLen / 2));
    const snippet = idx === -1 ? txt.slice(0, snippetLen) : txt.slice(start, start + snippetLen);
    results.push({
      ruling_id: r.id,
      case_number: r.decisionNo ?? r.caseNo ?? null,
      court: r.court,
      year_h: hijriYear(r.decisionDateText),
      match_offset: idx === -1 ? null : idx,
      snippet,
    });
  }

  const pageCourts = () => {
    const m = new Map<string | null, number>();
    for (const x of results) m.set(x.court, (m.get(x.court) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([court, count]) => ({ court, count }));
  };
  const base =
    withheld > 0
      ? { terms, filters: { court: court ?? null, year_h: yearH ?? null }, total: results.length, by_court: pageCourts(), counts_page_only: true }
      : { terms, filters: { court: court ?? null, year_h: yearH ?? null }, total, by_court: byCourt.map((c) => ({ court: c.court, count: Number(c.n) })) };

  if (countOnly) return base;

  const nextCursor = rows.length === size ? rows[rows.length - 1].id : null;

  return { ...base, page_size: pageSize, returned: results.length, next_cursor: nextCursor, results };
}

/**
 * rulings.ts — أدوات الأحكام القضائية (v3): جلب حكم كامل مقطّعًا، وحصر شامل غير مسقوف.
 *
 * مُكيَّف على المخطط الفعلي: النموذج JudicialCase (جدول "judicial_cases")، ونصّ الحكم
 * في "judgmentText"، ورقم القضية decisionNo/caseNo، والمحكمة court، ولا عمود سنة هجرية
 * (تُشتقّ من decisionDateText). فهرس pg_trgm على judgmentText قائمٌ سلفًا
 * (idx_trgm_jc_text عبر scripts/apply-search-indexes.ts) — يسرّع ILIKE على ٥١ ألف حكم.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** يشتقّ سنة هجرية (٤ خانات) من نصّ التاريخ إن وُجد. */
function hijriYear(text?: string | null): number | null {
  if (!text) return null;
  const m = text.match(/1[0-4]\d{2}/); // نطاق هجري معقول
  return m ? Number.parseInt(m[0], 10) : null;
}

// ١) جلب نص حكم كاملًا بمعرّفه مع تقطيع (offset/next_offset).
export async function getRuling(rulingId: string, offset = 0, maxChars = 30000) {
  const r = await prisma.judicialCase.findUnique({
    where: { id: rulingId },
    select: { id: true, caseNo: true, decisionNo: true, court: true, decisionDateText: true, judgmentText: true },
  });
  if (!r) return { error: "الحكم غير موجود بهذا المعرّف", ruling_id: rulingId };

  const full = r.judgmentText ?? "";
  const start = Math.max(0, Math.min(offset, full.length));
  const chunk = full.slice(start, start + maxChars);
  const nextOffset = start + chunk.length < full.length ? start + chunk.length : null;

  return {
    ruling_id: r.id,
    case_number: r.decisionNo ?? r.caseNo ?? null,
    court: r.court ?? null,
    year_h: hijriYear(r.decisionDateText),
    total_chars: full.length,
    offset: start,
    returned_chars: chunk.length,
    next_offset: nextOffset, // null = انتهى النص
    text: chunk,
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
  // تعقيم أحرف بدل ILIKE (% _ \) ثمّ تغليف بـ %..% — بمعاملات مربوطة (بلا حقن).
  const likeTerms = terms.map((t) => `%${t.replace(/[%_\\]/g, "")}%`);
  const termConds = Prisma.join(
    likeTerms.map((t) => Prisma.sql`r."judgmentText" ILIKE ${t}`),
    " OR ",
  );
  const filters: Prisma.Sql[] = [Prisma.sql`(${termConds})`];
  if (court) filters.push(Prisma.sql`r."court" ILIKE ${"%" + court + "%"}`);
  // لا عمود سنة هجرية — تقريبٌ بمطابقة نصّ التاريخ (تُشتقّ السنة في المخرجات).
  if (yearH) filters.push(Prisma.sql`r."decisionDateText" ILIKE ${"%" + yearH + "%"}`);
  const whereSql = Prisma.join(filters, " AND ");

  const totalRows = await prisma.$queryRaw<{ n: bigint }[]>(
    Prisma.sql`SELECT COUNT(*)::bigint AS n FROM "judicial_cases" r WHERE ${whereSql}`,
  );
  const total = Number(totalRows[0]?.n ?? 0);

  const byCourt = await prisma.$queryRaw<{ court: string | null; n: bigint }[]>(
    Prisma.sql`SELECT r."court" AS court, COUNT(*)::bigint AS n
               FROM "judicial_cases" r WHERE ${whereSql}
               GROUP BY r."court" ORDER BY n DESC LIMIT 30`,
  );

  const base = {
    terms,
    filters: { court: court ?? null, year_h: yearH ?? null },
    total,
    by_court: byCourt.map((c) => ({ court: c.court, count: Number(c.n) })),
  };

  if (countOnly) return base;

  const pageFilters = cursor ? Prisma.sql`${whereSql} AND r."id" > ${cursor}` : whereSql;
  const rows = await prisma.$queryRaw<
    Array<{ id: string; caseNo: string | null; decisionNo: string | null; court: string | null; decisionDateText: string | null; judgmentText: string }>
  >(
    Prisma.sql`SELECT r."id", r."caseNo", r."decisionNo", r."court", r."decisionDateText", r."judgmentText"
               FROM "judicial_cases" r WHERE ${pageFilters}
               ORDER BY r."id" ASC LIMIT ${pageSize}`,
  );

  // مقتطف حول أول لفظ مطابق (لا صدر الحكم) — للغرض التصنيفي (سياق اللفظ).
  const results = rows.map((r) => {
    const txt = r.judgmentText ?? "";
    let idx = -1;
    for (const t of terms) {
      const i = txt.indexOf(t);
      if (i !== -1 && (idx === -1 || i < idx)) idx = i;
    }
    const start = Math.max(0, idx - Math.floor(snippetLen / 2));
    const snippet = idx === -1 ? txt.slice(0, snippetLen) : txt.slice(start, start + snippetLen);
    return {
      ruling_id: r.id,
      case_number: r.decisionNo ?? r.caseNo ?? null,
      court: r.court,
      year_h: hijriYear(r.decisionDateText),
      match_offset: idx === -1 ? null : idx,
      snippet,
    };
  });

  const nextCursor = rows.length === pageSize ? rows[rows.length - 1].id : null;

  return { ...base, page_size: pageSize, returned: results.length, next_cursor: nextCursor, results };
}

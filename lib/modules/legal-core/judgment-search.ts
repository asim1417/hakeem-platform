// بحث الأحكام لواجهة /api/legal-core/search (منقول من ملف المسار ليُختبر).
// الحجب على الخادم: لا يُعثر على حكم بهوية أو جوال، ولا يخرج مقتطف بهما. النص المخزَّن لا يُمس.
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeArabicText } from "@/lib/modules/legal-core/arabic-morphology";
import { redactPII, stripPiiFromQuery } from "@/lib/modules/legal-core/rulings-search";

/** كلمات tsquery مُطبَّعة (نفس تطبيع search_norm) بصيغة OR — نظير بحث المواد. */
function judgmentTsQuery(query: string): string {
  const words = new Set<string>();
  for (const w of normalizeArabicText(query).split(/\s+/)) if (w.length >= 2) words.add(w);
  return [...words].slice(0, 40).join(" | ");
}

/**
 * بحث الأحكام:
 *   ① مفهرس أوّلًا: search_norm العربيّ المُطبَّع عبر فهرس GIN (نظير المواد) — يعالج تباين
 *      الصرف («مقاولات» ⇄ «للمقاولات»)، يرتّب بـ ts_rank_cd، ويبحث في المتن كلّه لا حقلٍ ضيّق.
 *   ② سقوط آمن للبحث المعجميّ (ILIKE) عند غياب العمود (قبل الهجرة/التعبئة) أو عدم وجود مطابقة —
 *      فلا ينكسر شيءٌ قبل تشغيل الهجرة والتعبئة، ويبقى الاستدعاء قائمًا أثناء الانتقال.
 */
export async function searchJudgments(rawQuery: string, page: number, limit: number) {
  // لا يُعثر على حكم بهوية أو جوال: يُزال النمط من الاستعلام قبل المسارين (المفهرس والمعجمي على النص الخام).
  const query = stripPiiFromQuery(rawQuery).query;
  if (!query.trim()) return [];
  const tsq = judgmentTsQuery(query);
  if (tsq) {
    try {
      const ranked = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
        // التعبير يطابق حرفيًّا فهرس idx_judicial_cases_search_norm_tsv (وإلّا مسحٌ تسلسليّ).
        `SELECT id FROM judicial_cases
         WHERE search_norm IS NOT NULL
           AND to_tsvector('simple', coalesce(search_norm, '')) @@ to_tsquery('simple', $1)
         ORDER BY ts_rank_cd(to_tsvector('simple', coalesce(search_norm, '')), to_tsquery('simple', $1)) DESC
         LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
        tsq
      );
      if (ranked.length) {
        const ids = ranked.map((r) => r.id);
        const rows = await prisma.judicialCase.findMany({
          where: { id: { in: ids } },
          include: { articleLinks: { include: { article: true }, take: 5 } }
        });
        const rank = new Map(ids.map((id, i) => [id, i]));
        rows.sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
        return rows.map((judgment) => mapJudgment(judgment, query));
      }
    } catch {
      /* العمود/الفهرس غير مطبَّق بعد → سقوط للمعجميّ */
    }
  }
  return searchJudgmentsLexical(query, page, limit);
}

/** المسار المعجميّ الاحتياطيّ (السلوك السابق) — ILIKE على أعمدة الحكم الخام. */
async function searchJudgmentsLexical(query: string, page: number, limit: number) {
  const judgments = await prisma.judicialCase.findMany({
    where: {
      OR: [
        { judgmentTitle: { contains: query, mode: "insensitive" } },
        { judgmentText: { contains: query, mode: "insensitive" } },
        { appealText: { contains: query, mode: "insensitive" } },
        { caseNo: { contains: query, mode: "insensitive" } },
        { decisionNo: { contains: query, mode: "insensitive" } }
      ]
    },
    include: { articleLinks: { include: { article: true }, take: 5 } },
    orderBy: [{ decisionDate: "desc" }, { createdAt: "desc" }],
    skip: (page - 1) * limit,
    take: limit
  });
  return judgments.map((judgment) => mapJudgment(judgment, query));
}

type JudgmentWithLinks = Prisma.JudicialCaseGetPayload<{
  include: { articleLinks: { include: { article: true } } };
}>;

function mapJudgment(judgment: JudgmentWithLinks, query: string) {
  return ({
    id: judgment.id,
    type: "judgment",
    resultType: "judicial_case",
    systemName: judgment.court ?? "حكم قضائي",
    systemId: null,
    articleNumber: null,
    title: judgment.judgmentTitle ?? "حكم قضائي مستورد",
    articleTitle: judgment.judgmentTitle ?? "حكم قضائي مستورد",
    snippet: buildJudgmentSnippet(judgment.judgmentText ?? "", query),
    matchedParagraphs: [],
    matchedTerms: [query],
    category: judgment.classification,
    classification: judgment.classification,
    chapter: judgment.cityName,
    url: `/dashboard/legal-core/judgments/${judgment.id}`,
    internalUrl: `/dashboard/legal-core/judgments/${judgment.id}`,
    citation: [judgment.court, judgment.caseNo ? `قضية ${judgment.caseNo}` : null, judgment.decisionNo ? `قرار ${judgment.decisionNo}` : null].filter(Boolean).join("، "),
    citationLabel: [judgment.court, judgment.caseNo ? `قضية ${judgment.caseNo}` : null, judgment.decisionNo ? `قرار ${judgment.decisionNo}` : null].filter(Boolean).join("، "),
    matchType: "contains",
    relevanceReason: "تطابق داخل مستودع الأحكام القضائية",
    relevanceScore: judgment.articleLinks.length ? 18 : 10
  });
}

/** مقتطف من النص بعد حجبه كاملًا، فلا يقطع القصُّ رقمًا يفلت من الحجب. */
export function buildJudgmentSnippet(raw: string, query: string) {
  const text = redactPII(raw);
  const index = text.indexOf(query);
  if (index < 0) return text.slice(0, 420);
  const start = Math.max(index - 140, 0);
  return `${start > 0 ? "..." : ""}${text.slice(start, start + 520)}${start + 520 < text.length ? "..." : ""}`;
}

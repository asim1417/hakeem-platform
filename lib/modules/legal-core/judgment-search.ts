// بحث الأحكام لواجهة /api/legal-core/search (منقول من ملف المسار ليُختبر).
// الحجب على الخادم: لا يُعثر على حكم بهوية أو جوال، ولا يخرج مقتطف بهما. النص المخزَّن لا يُمس.
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { normalizeArabicText } from "@/lib/modules/legal-core/arabic-morphology";
import {
  findRulingIdsRedacted,
  redactPII,
  splitRulingQuery,
  tokensInRedacted,
  type RulingQueryParts
} from "@/lib/modules/legal-core/rulings-search";
import { queryTokens } from "@/lib/modules/legal-core/ruling-excerpts";
import { rulingNumbersSql } from "@/lib/modules/legal-core/ruling-redacted-sql";
import { maskPersonalData } from "@/lib/rulings/research/mask";

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
 *   ② سقوط آمن للبحث المعجميّ عند غياب العمود أو عدم وجود مطابقة.
 * الحجب (HKM-012): الهوية والجوال تُزالان من الاستعلام، والأرقام الطويلة تُطابَق في رقم القضية
 * والقرار فقط، والمتن والاستئناف يُطابَقان منقّحين؛ فلا يُعثر على حكم بجزء من رقم محجوب ولا
 * بإضافة «المادة» أو «صك» قبله.
 */
export async function searchJudgments(rawQuery: string, page: number, limit: number, opts: { maskNames?: boolean } = {}) {
  const parts = splitRulingQuery(rawQuery);
  if (!parts.text && !parts.numbers.length) return [];
  // المفهرس للألفاظ العربية فقط: لفظ حساس وحده قد يطابق في search_norm بقايا محجوب لا ينظّفها #704.
  const tsq = parts.hasPlainToken ? judgmentTsQuery(parts.text) : "";
  if (tsq) {
    try {
      const params: unknown[] = [tsq];
      const numberConds = rulingNumbersSql(parts.numbers, params);
      const ranked = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
        // التعبير يطابق حرفيًّا فهرس idx_judicial_cases_search_norm_tsv (وإلّا مسحٌ تسلسليّ).
        `SELECT id FROM judicial_cases
         WHERE search_norm IS NOT NULL
           AND to_tsvector('simple', coalesce(search_norm, '')) @@ to_tsquery('simple', $1)
           ${numberConds.map((c) => `AND ${c}`).join(" ")}
         ORDER BY ts_rank_cd(to_tsvector('simple', coalesce(search_norm, '')), to_tsquery('simple', $1)) DESC
         LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
        ...params
      );
      if (ranked.length) {
        const ids = ranked.map((r) => r.id);
        const rows = await prisma.judicialCase.findMany({
          where: { id: { in: ids } },
          include: { articleLinks: { include: { article: true }, take: 5 } }
        });
        const rank = new Map(ids.map((id, i) => [id, i]));
        rows.sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
        // الألفاظ بـ OR: يبقى الحكم إن ورد في نصه المنقّح لفظ عربي أو لفظ حساس، لا بالمحجوب وحده.
        const visible = parts.sensitiveTokens.length
          ? rows.filter((r) => tokensInRedacted(`${r.judgmentTitle ?? ""} ${r.judgmentText ?? ""} ${r.appealText ?? ""}`, queryTokens(parts.text), "any"))
          : rows;
        if (visible.length) return visible.map((judgment) => mapJudgment(judgment, queryLabel(parts), opts.maskNames));
      }
    } catch {
      /* العمود/الفهرس غير مطبَّق بعد → سقوط للمعجميّ */
    }
  }
  return searchJudgmentsLexical(parts, page, limit, opts.maskNames);
}

/** المسار المعجميّ الاحتياطيّ: احتواء على المحتوى المنقّح داخل القاعدة (العنوان والمتن والاستئناف). */
async function searchJudgmentsLexical(parts: RulingQueryParts, page: number, limit: number, maskNames = false) {
  const ids = await findRulingIdsRedacted(parts, { limit, offset: (page - 1) * limit });
  if (!ids.length) return [];
  const judgments = await prisma.judicialCase.findMany({
    where: { id: { in: ids } },
    include: { articleLinks: { include: { article: true }, take: 5 } }
  });
  const order = new Map(ids.map((id, i) => [id, i]));
  judgments.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  return judgments.map((judgment) => mapJudgment(judgment, queryLabel(parts), maskNames));
}

const queryLabel = (parts: RulingQueryParts) => parts.text || parts.numbers.join(" ");

type JudgmentWithLinks = Prisma.JudicialCaseGetPayload<{
  include: { articleLinks: { include: { article: true } } };
}>;

function mapJudgment(judgment: JudgmentWithLinks, query: string, maskNames = false) {
  return ({
    id: judgment.id,
    type: "judgment",
    resultType: "judicial_case",
    systemName: judgment.court ?? "حكم قضائي",
    systemId: null,
    articleNumber: null,
    title: judgment.judgmentTitle ?? "حكم قضائي مستورد",
    articleTitle: judgment.judgmentTitle ?? "حكم قضائي مستورد",
    snippet: buildJudgmentSnippet(judgment.judgmentText ?? "", query, maskNames),
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

/** مقتطف من النص بعد حجبه كاملًا، فلا يقطع القصُّ رقمًا يفلت من الحجب. maskNames: أسماء الأفراد أيضًا (المتدرّب). */
export function buildJudgmentSnippet(raw: string, query: string, maskNames = false) {
  const text = maskNames ? maskPersonalData(raw) : redactPII(raw);
  const index = query ? text.indexOf(query) : -1;
  if (index < 0) return text.slice(0, 420);
  const start = Math.max(index - 140, 0);
  return `${start > 0 ? "..." : ""}${text.slice(start, start + 520)}${start + 520 < text.length ? "..." : ""}`;
}

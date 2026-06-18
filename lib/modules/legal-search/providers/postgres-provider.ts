import { prisma } from "@/lib/prisma";
import { findRelevantLegalArticles } from "@/lib/modules/legal-core/legal-retrieval";
import type { RawResult, SearchProvider, SearchQuery } from "./search-provider";

// مزوّد البحث النصّي على PostgreSQL — متاح دائماً (قاعدة المنصّة الأساسية).
//
// المواد: يعتمد على بحث النواة العربي (findRelevantLegalArticles) الذي يفكّك السؤال
//   إلى كلمات/مشتقّات ويرتّب بالصلة — فيعمل مع الأسئلة الطبيعية لا العبارة الكاملة فقط.
// الأحكام/المبادئ: تفكيك خفيف للسؤال إلى كلمات دالّة + مطابقة OR، بدل مطابقة
//   العبارة الكاملة التي كانت لا تجد شيئاً لسؤال طبيعي مثل «هل يجوز فسخ العقد بسبب الغبن».

// كلمات وقف خفيفة شائعة في صياغة الأسئلة — تُستبعد كي لا تُفسد المطابقة.
const QUESTION_STOPWORDS = new Set<string>([
  "هل", "يجوز", "ماهي", "ماهو", "متى", "كيف", "أين", "لماذا", "ما", "هي", "هو",
  "من", "في", "على", "عن", "الى", "إلى", "او", "أو", "ثم", "قد", "كل", "بعد",
  "قبل", "عند", "هذا", "هذه", "ذلك", "تلك", "التي", "الذي", "غير", "بين", "مع",
  "بسبب", "حكم", "نظام", "حالة", "شأن", "وفق", "بشأن", "يكون", "تكون",
]);

/** يفكّك السؤال إلى كلمات دالّة (≥٣ أحرف، بلا كلمات وقف)، حتى ٨ كلمات متمايزة. */
export function tokenizeQuery(q: string): string[] {
  return Array.from(
    new Set(
      (q || "")
        .split(/\s+/)
        .map((w) => w.trim())
        .filter((w) => w.length >= 3 && !QUESTION_STOPWORDS.has(w))
    )
  ).slice(0, 8);
}

/** يحوّل درجة الصلة المفتوحة (من بحث النواة) إلى درجة 0..1 ضمن نطاق متّسق مع المزوّدات. */
export function normalizeLexicalScore(relevance: number, maxRelevance: number): number {
  if (!Number.isFinite(relevance) || relevance <= 0) return 0.55;
  const ratio = maxRelevance > 0 ? relevance / maxRelevance : 0;
  return Math.max(0.55, Math.min(0.95, 0.55 + 0.4 * ratio));
}

/** يبني مرشّح OR على عدّة حقول لكل كلمة دالّة (أو العبارة الكاملة عند غياب كلمات). */
function tokenOrFilter(tokens: string[], fullTerm: string, fields: string[]) {
  const values = tokens.length ? tokens : [fullTerm];
  return {
    OR: values.flatMap((value) =>
      fields.map((field) => ({ [field]: { contains: value, mode: "insensitive" as const } }))
    ),
  };
}

export const postgresProvider: SearchProvider = {
  name: "postgres",

  async isAvailable() {
    return true;
  },

  async search({ q, limit = 10 }: SearchQuery): Promise<RawResult[]> {
    const term = q.trim();
    if (term.length < 2) return [];
    const take = Math.min(limit, 20);
    const tokens = tokenizeQuery(term);
    const results: RawResult[] = [];

    // المواد النظامية — عبر بحث النواة العربي (تفكيك + مشتقّات + ترتيب بالصلة).
    // semantic:false كي يبقى هذا المزوّد معجمياً صرفاً (الدلالي مسؤولية vector-provider).
    try {
      const articles = await findRelevantLegalArticles(term, { limit: take, semantic: false });
      const maxRel = Math.max(1, ...articles.map((a) => a.relevanceScore));
      for (const a of articles) {
        results.push({
          type: "article",
          id: a.articleId,
          title: `${a.systemName} — م/${a.articleNumber}: ${a.articleTitle}`,
          snippet: a.snippet,
          score: normalizeLexicalScore(a.relevanceScore, maxRel),
          source: "postgres",
          reason: a.relevanceReason || "تطابق نصّي في المادة",
          meta: { matchedBy: "lexical", sourceType: "article", articleId: a.articleId, systemName: a.systemName, articleNumber: a.articleNumber },
        });
      }
    } catch {
      /* تجاهل وأكمل بقية الأنواع */
    }

    try {
      // الأحكام القضائية — مطابقة كلمات السؤال الدالّة.
      const rulings = await prisma.judicialCase.findMany({
        where: tokenOrFilter(tokens, term, ["judgmentTitle", "judgmentText"]),
        select: { id: true, judgmentTitle: true, judgmentText: true, caseNo: true, decisionNo: true, court: true },
        take,
      });
      for (const r of rulings) {
        const hay = `${r.judgmentTitle ?? ""}\n${r.judgmentText ?? ""}`;
        const inTitle = tokens.some((t) => (r.judgmentTitle ?? "").includes(t)) || (r.judgmentTitle ?? "").includes(term);
        const hits = tokens.filter((t) => hay.includes(t)).length;
        const base = inTitle ? 0.78 : 0.58;
        results.push({
          type: "ruling",
          id: r.id,
          title: `حكم ${r.decisionNo ?? r.caseNo ?? r.id}${r.court ? ` — ${r.court}` : ""}`,
          snippet: (r.judgmentText ?? "").slice(0, 200),
          score: Math.min(0.9, base + Math.min(hits, 3) * 0.03),
          source: "postgres",
          reason: `تطابق نصّي في ${inTitle ? "عنوان الحكم" : "نص الحكم"}`,
          meta: { matchedBy: "lexical", sourceType: "ruling", caseNo: r.caseNo, decisionNo: r.decisionNo, court: r.court },
        });
      }

      // المبادئ القضائية — مطابقة كلمات السؤال الدالّة.
      const principles = await prisma.judicialPrinciple.findMany({
        where: tokenOrFilter(tokens, term, ["title", "principleText"]),
        select: { id: true, title: true, principleText: true },
        take,
      });
      for (const p of principles) {
        results.push({
          type: "principle",
          id: p.id,
          title: `مبدأ: ${p.title}`,
          snippet: p.principleText.slice(0, 200),
          score: 0.7,
          source: "postgres",
          reason: "تطابق نصّي في المبدأ",
          meta: { matchedBy: "lexical", sourceType: "principle" },
        });
      }
    } catch {
      return results; // أعد ما جُمع قبل الخطأ دون كسر
    }

    return results;
  },
};

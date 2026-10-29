import { prisma } from "@/lib/prisma";
import { findRelevantLegalArticles } from "@/lib/modules/legal-core/legal-retrieval";
import { maskPersonalData } from "@/lib/rulings/research/mask";
import { scopedLawIds, wantsType, type RawResult, type SearchProvider, type SearchQuery } from "./search-provider";

// مزوّد البحث النصّي على PostgreSQL — متاح دائماً (قاعدة المنصّة الأساسية).
//
// المواد: يعتمد على بحث النواة العربي (findRelevantLegalArticles) الذي يفكّك السؤال
//   إلى كلمات/مشتقّات ويرتّب بالصلة — فيعمل مع الأسئلة الطبيعية لا العبارة الكاملة فقط.
// الأحكام/المبادئ: تفكيك خفيف للسؤال إلى كلمات دالّة + مطابقة OR، بدل مطابقة
//   العبارة الكاملة التي كانت لا تجد شيئاً لسؤال طبيعي مثل «هل يجوز فسخ العقد بسبب الغبن».
// HKM-012: هذا المزوّد لا يعرف دور المستخدم، فمقتطفات الأحكام والمبادئ تُحجب للجميع بـ maskPersonalData
//   (الأرقام الشخصية وأسماء الأفراد) كمسار الموصل، والحجب قبل القص (كان المقتطف يُقص من النص الخام
//   فتخرج أسماء الأطراف في ديباجة الحكم). النص المخزَّن لا يُمس.

/** مقتطف من نص محجوب كاملًا ثم مقصوص (الحجب قبل القص). */
export function maskedSnippet(text: string | null | undefined, max = 200): string {
  return maskPersonalData(text).slice(0, max);
}

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

  async search(query: SearchQuery): Promise<RawResult[]> {
    const { q, limit = 10, context } = query;
    const term = q.trim();
    if (term.length < 2) return [];
    const take = Math.min(limit, 20);
    const tokens = tokenizeQuery(term);
    const results: RawResult[] = [];
    const t0 = Date.now();
    const ms: Record<string, number> = {};
    // [إصلاح SEARCH-002] فلتر المحكمة يُطبَّق فعليًّا على الأحكام إن مُرّر (كان يُتجاهَل).
    const courtFilter = context?.court?.trim()
      ? { court: { contains: context.court.trim(), mode: "insensitive" as const } }
      : null;

    // المواد النظامية — عبر بحث النواة العربي (تفكيك + مشتقّات + ترتيب بالصلة).
    // semantic:false كي يبقى هذا المزوّد معجمياً صرفاً (الدلالي مسؤولية vector-provider).
    try {
      // HKM-053: الحصر بالنظام شرط داخل بحث النواة (systemIds) لا تصفية بعده.
      const articles = !wantsType(query, "article") ? [] : await findRelevantLegalArticles(term, { limit: take, semantic: false, systemIds: scopedLawIds(query) ?? undefined });
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
          meta: { matchedBy: "lexical", sourceType: "article", articleId: a.articleId, systemName: a.systemName, articleNumber: a.articleNumber, classification: a.classification ?? undefined, status: a.status ?? undefined },
        });
      }
    } catch {
      /* تجاهل وأكمل بقية الأنواع */
    }
    ms.articles = Date.now() - t0;

    try {
      // الأحكام القضائية — مطابقة كلمات السؤال الدالّة (إن طُلبت).
      const rulings = !wantsType(query, "ruling") ? [] : await prisma.judicialCase.findMany({
        where: courtFilter
          ? { AND: [tokenOrFilter(tokens, term, ["judgmentTitle", "judgmentText"]), courtFilter] }
          : tokenOrFilter(tokens, term, ["judgmentTitle", "judgmentText"]),
        select: { id: true, judgmentTitle: true, judgmentText: true, caseNo: true, decisionNo: true, court: true, decisionDate: true, decisionDateText: true, reviewStatus: true },
        take,
      });
      for (const r of rulings) {
        const hay = `${r.judgmentTitle ?? ""}\n${r.judgmentText ?? ""}`;
        const inTitle = tokens.some((t) => (r.judgmentTitle ?? "").includes(t)) || (r.judgmentTitle ?? "").includes(term);
        const hits = tokens.filter((t) => hay.includes(t)).length;
        const base = inTitle ? 0.78 : 0.58;
        // السنة الميلادية للحكم (للفلترة الزمنية) — من التاريخ المهيكل إن وُجد.
        const year = r.decisionDate ? String(r.decisionDate.getFullYear()) : undefined;
        // [إصلاح SEARCH-006] المحتوى غير المُراجَع (needs_review) يُخفَّض ترتيبه ويُعلَّم،
        // بدل حجبه (حجبه قد يُفرغ النتائج إن لم تُراجَع بعد)، فيتقدّم المُعتمد.
        const reviewed = r.reviewStatus !== "needs_review";
        const score = Math.min(0.9, base + Math.min(hits, 3) * 0.03) * (reviewed ? 1 : 0.85);
        results.push({
          type: "ruling",
          id: r.id,
          title: `حكم ${r.decisionNo ?? r.caseNo ?? r.id}${r.court ? ` — ${r.court}` : ""}`,
          snippet: maskedSnippet(r.judgmentText),
          score,
          source: "postgres",
          reason: `تطابق نصّي في ${inTitle ? "عنوان الحكم" : "نص الحكم"}${reviewed ? "" : " (غير مُراجَع)"}`,
          meta: { matchedBy: "lexical", sourceType: "ruling", caseNo: r.caseNo, decisionNo: r.decisionNo, court: r.court, year, decisionDateText: r.decisionDateText ?? undefined, reviewed },
        });
      }

      ms.rulings = Date.now() - t0 - ms.articles;
      // المبادئ القضائية — مطابقة كلمات السؤال الدالّة (إن طُلبت).
      const principles = !wantsType(query, "principle") ? [] : await prisma.judicialPrinciple.findMany({
        where: tokenOrFilter(tokens, term, ["title", "principleText"]),
        select: { id: true, title: true, principleText: true, reviewStatus: true },
        take,
      });
      for (const p of principles) {
        // [إصلاح SEARCH-006] نفس المبدأ: خفض ترتيب غير المُراجَع ووسمه بدل حجبه.
        const reviewed = p.reviewStatus !== "needs_review";
        results.push({
          type: "principle",
          id: p.id,
          title: `مبدأ: ${maskPersonalData(p.title)}`,
          snippet: maskedSnippet(p.principleText),
          score: reviewed ? 0.7 : 0.6,
          source: "postgres",
          reason: `تطابق نصّي في المبدأ${reviewed ? "" : " (غير مُراجَع)"}`,
          meta: { matchedBy: "lexical", sourceType: "principle", reviewed },
        });
      }
    } catch {
      return results; // أعد ما جُمع قبل الخطأ دون كسر
    }

    console.info(`[search] postgres articles=${ms.articles} rulings=${ms.rulings ?? 0} principles=${Date.now() - t0 - ms.articles - (ms.rulings ?? 0)}`);
    return results;
  },
};

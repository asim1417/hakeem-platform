import { prisma } from "@/lib/prisma";
import type { RawResult, SearchProvider, SearchQuery } from "./search-provider";

// مزوّد البحث النصّي على PostgreSQL — متاح دائماً (قاعدة المنصّة الأساسية).
export const postgresProvider: SearchProvider = {
  name: "postgres",

  async isAvailable() {
    return true;
  },

  async search({ q, limit = 10 }: SearchQuery): Promise<RawResult[]> {
    const term = q.trim();
    if (term.length < 2) return [];
    const take = Math.min(limit, 20);
    const results: RawResult[] = [];

    try {
      // المواد النظامية
      const articles = await prisma.legalArticle.findMany({
        where: {
          OR: [
            { title: { contains: term, mode: "insensitive" } },
            { content: { contains: term, mode: "insensitive" } },
          ],
        },
        select: { id: true, title: true, content: true, lawName: true, articleNumber: true },
        take,
      });
      for (const a of articles) {
        const inTitle = a.title.includes(term);
        results.push({
          type: "article",
          id: a.id,
          title: `${a.lawName} — م/${a.articleNumber}: ${a.title}`,
          snippet: a.content.slice(0, 200),
          score: inTitle ? 0.85 : 0.65,
          source: "postgres",
          reason: `تطابق نصّي في ${inTitle ? "عنوان المادة" : "نص المادة"}`,
          meta: { matchedBy: "lexical", sourceType: "article", articleId: a.id, systemName: a.lawName, articleNumber: a.articleNumber },
        });
      }

      // الأحكام القضائية
      const rulings = await prisma.judicialCase.findMany({
        where: {
          OR: [
            { judgmentTitle: { contains: term, mode: "insensitive" } },
            { judgmentText: { contains: term, mode: "insensitive" } },
          ],
        },
        select: { id: true, judgmentTitle: true, judgmentText: true, caseNo: true, decisionNo: true, court: true },
        take,
      });
      for (const r of rulings) {
        const inTitle = (r.judgmentTitle ?? "").includes(term);
        results.push({
          type: "ruling",
          id: r.id,
          title: `حكم ${r.decisionNo ?? r.caseNo ?? r.id}${r.court ? ` — ${r.court}` : ""}`,
          snippet: (r.judgmentText ?? "").slice(0, 200),
          score: inTitle ? 0.8 : 0.6,
          source: "postgres",
          reason: `تطابق نصّي في ${inTitle ? "عنوان الحكم" : "نص الحكم"}`,
          meta: { matchedBy: "lexical", sourceType: "ruling", caseNo: r.caseNo, decisionNo: r.decisionNo, court: r.court },
        });
      }

      // المبادئ القضائية
      const principles = await prisma.judicialPrinciple.findMany({
        where: {
          OR: [
            { title: { contains: term, mode: "insensitive" } },
            { principleText: { contains: term, mode: "insensitive" } },
          ],
        },
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

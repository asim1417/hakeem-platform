import type { LegalArticle } from "@prisma/client";

export function requireLibraryCitations(articles: LegalArticle[]) {
  if (articles.length === 0) {
    return {
      passed: false,
      message: "لا يمكن توليد مخرج ذكاء اصطناعي دون مواد مسترجعة من المكتبة النظامية."
    };
  }

  return { passed: true, message: "تم العثور على مواد نظامية من مصدر الحقيقة." };
}

export function buildCitationFence(articles: LegalArticle[]) {
  const allowed = new Set(articles.map((article) => `${article.lawName}::${article.articleNumber}`));

  return {
    allowed,
    assertAllowed(lawName: string, articleNumber: number) {
      if (!allowed.has(`${lawName}::${articleNumber}`)) {
        throw new Error("استشهاد غير مسموح لأنه خارج المواد المسترجعة من المكتبة النظامية.");
      }
    }
  };
}

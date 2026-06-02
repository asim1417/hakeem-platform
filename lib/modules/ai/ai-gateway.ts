import { randomUUID } from "crypto";
import { searchLegalArticles } from "@/lib/modules/library/library-service";
import { recordGuardrail } from "@/lib/modules/audit/audit";
import { buildCitationFence, requireLibraryCitations } from "@/lib/modules/ai/guardrails";

export async function createConsultationDraft(input: { facts: string; actorId?: string }) {
  const requestId = randomUUID();
  const articles = await searchLegalArticles(input.facts, 6);
  const citationGuard = requireLibraryCitations(articles);

  await recordGuardrail({
    subject: "AI_GATEWAY",
    requestId,
    guardName: "library-citations-only",
    result: citationGuard.passed ? "PASSED" : "BLOCKED",
    details: { message: citationGuard.message, retrievedArticles: articles.length }
  });

  if (!citationGuard.passed) {
    return {
      requestId,
      blocked: true,
      output: citationGuard.message,
      citations: [],
      qualityReport: { guards: [citationGuard] }
    };
  }

  const fence = buildCitationFence(articles);
  const citations = articles.map((article) => {
    fence.assertAllowed(article.lawName, article.articleNumber);
    return {
      articleId: article.id,
      lawName: article.lawName,
      articleNumber: article.articleNumber,
      quote: article.content.slice(0, 350)
    };
  });

  const output = [
    "تنبيه: هذا المخرج مساعد وتعليمي ولا يعد رأيًا قانونيًا نهائيًا.",
    "",
    "1. الوقائع المختصرة",
    input.facts,
    "",
    "2. المواد النظامية ذات الصلة",
    ...citations.map((citation) => `- ${citation.lawName}، المادة ${citation.articleNumber}: ${citation.quote}`),
    "",
    "3. توجيه أولي",
    "ينبغي مراجعة الوقائع والمستندات يدويًا وربطها بالمواد أعلاه قبل اعتماد أي مسار مهني."
  ].join("\n");

  return {
    requestId,
    blocked: false,
    output,
    citations,
    qualityReport: {
      guards: [citationGuard],
      sourceOfTruth: "legal_articles",
      aiProvider: process.env.AI_PROVIDER ?? "offline"
    }
  };
}

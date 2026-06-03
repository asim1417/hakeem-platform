import { randomUUID } from "crypto";
import { searchLegalArticles } from "@/lib/modules/library/library-service";
import { auditEvent, recordGuardrail } from "@/lib/modules/audit/audit";
import { buildCitationFence, requireLibraryCitations } from "@/lib/modules/ai/guardrails";

type AiResult = {
  requestId: string;
  blocked: boolean;
  output: string;
  citations: Array<{ articleId: string; lawName: string; articleNumber: number; quote: string }>;
  qualityReport: Record<string, unknown>;
  provider: string;
  mode: "offline" | "live";
};

export async function createConsultationDraft(input: { facts: string; actorId?: string }): Promise<AiResult> {
  const requestId = randomUUID();
  const provider = (process.env.AI_PROVIDER || "offline").toLowerCase();
  const articles = await searchLegalArticles(input.facts, 8);
  const citationGuard = requireLibraryCitations(articles);

  await recordGuardrail({
    subject: "AI_GATEWAY",
    requestId,
    guardName: "library-citations-only",
    result: citationGuard.passed ? "PASSED" : "BLOCKED",
    details: { message: citationGuard.message, retrievedArticles: articles.length, provider }
  });

  if (!citationGuard.passed) {
    const output = "لم يتم العثور على مادة نظامية مطابقة في قاعدة البيانات الحالية.";
    await recordAiAudit(input.actorId, requestId, provider, false, "CONSULTATION_BLOCKED", { retrievedArticles: 0 });
    return {
      requestId,
      blocked: true,
      output,
      citations: [],
      provider,
      mode: provider === "offline" ? "offline" : "live",
      qualityReport: { guards: [citationGuard], sourceOfTruth: "legal_articles", provider }
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

  const live = provider !== "offline" ? await callLiveProvider(provider, input.facts, citations).catch((error) => ({ ok: false as const, text: `تعذر استدعاء مزود الذكاء الاصطناعي: ${error instanceof Error ? error.message : "خطأ غير معروف"}` })) : null;
  const output = live?.ok ? sanitizeOutput(live.text, citations) : offlineOutput(input.facts, citations);
  const tokenEstimate = Math.ceil((input.facts.length + output.length) / 4);

  await recordAiAudit(input.actorId, requestId, provider, true, live?.ok ? "AI_LIVE_COMPLETED" : "AI_OFFLINE_COMPLETED", {
    retrievedArticles: articles.length,
    citations: citations.length,
    tokenEstimate,
    liveFailure: live && !live.ok ? live.text : undefined
  });

  return {
    requestId,
    blocked: false,
    output,
    citations,
    provider,
    mode: live?.ok ? "live" : "offline",
    qualityReport: {
      guards: [citationGuard],
      sourceOfTruth: "legal_articles",
      aiProvider: provider,
      mode: live?.ok ? "live" : "offline",
      tokenEstimate
    }
  };
}

async function callLiveProvider(provider: string, facts: string, citations: AiResult["citations"]) {
  const system = [
    "أنت مساعد قانوني تعليمي لمنصة حكيم.",
    "لا تستشهد إلا بالمواد المرسلة داخل قائمة citations.",
    "لا تخترع مواد أو أرقام مواد.",
    "إذا لم تكف المواد فصرح بذلك.",
    "أعد تحليلاً عربيًا منظمًا مع التنبيه المهني."
  ].join("\n");
  const user = `الواقعة:\n${facts}\n\nالمواد المسموح بها فقط:\n${citations.map((item) => `- ${item.lawName}، المادة ${item.articleNumber}: ${item.quote}`).join("\n")}`;

  if (provider === "openai") {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("OPENAI_API_KEY غير مضبوط.");
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user }
        ],
        temperature: 0.2
      })
    });
    if (!response.ok) throw new Error(`OpenAI ${response.status}`);
    const payload = await response.json();
    return { ok: true as const, text: payload.choices?.[0]?.message?.content || "" };
  }

  if (provider === "anthropic") {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error("ANTHROPIC_API_KEY غير مضبوط.");
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-3-5-haiku-latest",
        max_tokens: 1200,
        system,
        messages: [{ role: "user", content: user }]
      })
    });
    if (!response.ok) throw new Error(`Anthropic ${response.status}`);
    const payload = await response.json();
    return { ok: true as const, text: payload.content?.map((part: { text?: string }) => part.text).filter(Boolean).join("\n") || "" };
  }

  return { ok: false as const, text: `المزود ${provider} غير مدعوم، تم استخدام الوضع offline.` };
}

function sanitizeOutput(output: string, citations: AiResult["citations"]) {
  const allowed = new Set(citations.map((item) => `${item.lawName}-${item.articleNumber}`));
  const suspiciousArticleNumbers = [...output.matchAll(/المادة\s+(\d+)/g)].map((match) => Number(match[1]));
  const allowedNumbers = new Set(citations.map((item) => item.articleNumber));
  const hasForbiddenNumber = suspiciousArticleNumbers.some((number) => !allowedNumbers.has(number));
  if (hasForbiddenNumber || allowed.size === 0) return offlineOutput("تم حجب جزء من مخرج الذكاء الاصطناعي بسبب استشهاد غير مسموح.", citations);
  return `${output}\n\nتنبيه مهني: هذه المخرجات مساعدة أولية ولا تعد رأيًا قانونيًا نهائيًا أو بديلًا عن مراجعة محامٍ مختص.`;
}

function offlineOutput(facts: string, citations: AiResult["citations"]) {
  return [
    "تنبيه مهني: هذه المخرجات مساعدة أولية ولا تعد رأيًا قانونيًا نهائيًا أو بديلًا عن مراجعة محامٍ مختص.",
    "",
    "1. ملخص الواقعة",
    facts,
    "",
    "2. المواد النظامية المستند إليها",
    ...citations.map((citation) => `- ${citation.lawName}، المادة ${citation.articleNumber}: ${citation.quote}`),
    "",
    "3. تحليل أولي",
    "يرتبط التحليل فقط بالمواد النظامية أعلاه لأنها موجودة في قاعدة بيانات المكتبة النظامية. يجب مراجعة المستندات والبينات يدويًا قبل اعتماد أي مسار مهني."
  ].join("\n");
}

async function recordAiAudit(actorId: string | undefined, requestId: string, provider: string, success: boolean, action: string, metadata: Record<string, unknown>) {
  await auditEvent({
    actorId,
    subject: "AI_GATEWAY",
    action,
    metadata: {
      requestId,
      provider,
      success,
      module: "consultations",
      ...metadata
    }
  }).catch(() => undefined);
}

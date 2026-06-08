import { randomUUID } from "crypto";
import { auditEvent, recordGuardrail } from "@/lib/modules/audit/audit";
import { buildLegalContextForAI, noLegalArticleMessage } from "@/lib/modules/legal-core/legal-retrieval";
import type { LegalCoreResult } from "@/lib/modules/legal-core/legal-retrieval";
import { assertHasLegalArticles, guardOutputAgainstUnknownArticleNumbers } from "@/lib/modules/legal-core/legal-citation-guard";
import { parseArticleNumberCandidates } from "@/lib/modules/legal-core/judgment-citation-extractor";
import { resolveAiConfig } from "@/lib/modules/ai/ai-config";

type AiResult = {
  requestId: string;
  blocked: boolean;
  output: string;
  citations: Array<{ articleId: string; lawName: string; articleNumber: number; quote: string }>;
  qualityReport: Record<string, unknown>;
  provider: string;
  mode: "offline" | "live";
};

export type OriginalHakeemAiInput = {
  provider?: "openai" | "anthropic" | "gemini" | "custom" | "offline";
  model?: string;
  messages?: Array<{ role?: string; content?: string }>;
  prompt?: string;
  module?: string;
  context?: Record<string, unknown>;
  actorId?: string;
};

export type OriginalHakeemAiResult = {
  ok: boolean;
  provider: string;
  model: string;
  content: string;
  warnings: string[];
  mode: "server" | "offline";
  requestId: string;
};

export async function createConsultationDraft(input: { facts: string; actorId?: string }): Promise<AiResult> {
  const requestId = randomUUID();
  const cfg = await resolveAiConfig();
  const provider = cfg.provider;
  const legalContext = await buildLegalContextForAI(input.facts, { limit: 8 });
  const citationGuard = assertHasLegalArticles(legalContext.articles);

  await recordGuardrail({
    subject: "AI_GATEWAY",
    requestId,
    guardName: "legal-core-citations-only",
    result: citationGuard.ok ? "PASSED" : "BLOCKED",
    details: { message: citationGuard.ok ? "تم العثور على مواد نظامية من النواة القانونية." : citationGuard.message, retrievedArticles: legalContext.articles.length, provider }
  });

  if (!citationGuard.ok) {
    await recordAiAudit(input.actorId, requestId, provider, false, "CONSULTATION_BLOCKED", { retrievedArticles: 0, source: "legal_core" });
    return {
      requestId,
      blocked: true,
      output: noLegalArticleMessage,
      citations: [],
      provider,
      mode: provider === "offline" ? "offline" : "live",
      qualityReport: { guards: [citationGuard], sourceOfTruth: "legal_core.legal_articles", provider }
    };
  }

  const citations = legalContext.articles.map((article) => ({
    articleId: article.articleId,
    lawName: article.systemName,
    articleNumber: article.articleNumber,
    quote: article.articleText.slice(0, 350)
  }));

  const live = provider !== "offline" ? await callLiveProvider(provider, `${input.facts}\n\n${legalContext.contextText}`, citations, cfg).catch((error) => ({ ok: false as const, text: `تعذر استدعاء مزود الذكاء الاصطناعي: ${error instanceof Error ? error.message : "خطأ غير معروف"}` })) : null;
  const output = live?.ok ? sanitizeOutput(live.text, citations, legalContext.articles) : offlineOutput(input.facts, citations);
  const tokenEstimate = Math.ceil((input.facts.length + output.length + legalContext.contextText.length) / 4);

  await recordAiAudit(input.actorId, requestId, provider, true, live?.ok ? "AI_LIVE_COMPLETED" : "AI_OFFLINE_COMPLETED", {
    retrievedArticles: legalContext.articles.length,
    citations: citations.length,
    tokenEstimate,
    source: "legal_core",
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
      sourceOfTruth: "legal_core.legal_articles",
      aiProvider: provider,
      mode: live?.ok ? "live" : "offline",
      tokenEstimate
    }
  };
}
export async function createOriginalHakeemAiResponse(input: OriginalHakeemAiInput): Promise<OriginalHakeemAiResult> {
  const requestId = randomUUID();
  const cfg = await resolveAiConfig();
  const requestedProvider = (input.provider || cfg.provider || "offline").toLowerCase();
  const provider = normalizeOriginalProvider(requestedProvider);
  const prompt = buildOriginalPrompt(input);
  const warnings = [
    "هذه المخرجات مساعدة تدريبية داخل منصة حكيم، ولا تعد رأيا قانونيا نهائيا أو حكما قضائيا فعليا.",
    "لا يتم إرسال أي مفتاح API إلى الواجهة عند استخدام البوابة الخلفية."
  ];

  const legalContext = await buildLegalContextForAI(prompt, { limit: 6 }).catch(() => ({
    hasArticles: false,
    articles: [],
    citationBlock: noLegalArticleMessage,
    contextText: noLegalArticleMessage
  }));
  if (provider === "offline") {
    const content = buildOriginalOfflineResponse(prompt, legalContext.contextText);
    await recordOriginalHakeemAiAudit(input.actorId, requestId, provider, true, "ORIGINAL_HAKEEM_AI_OFFLINE", {
      requestedProvider,
      citations: legalContext.articles.length,
      mode: "offline"
    });
    return {
      ok: true,
      provider,
      model: "offline",
      content,
      warnings,
      mode: "offline",
      requestId
    };
  }

  try {
    const model = resolveOriginalModel(provider, input.model || cfg.model || undefined);
    const content = await callOriginalProvider(provider, model, prompt, legalContext.contextText, cfg);
    const outputGuard = guardOutputAgainstUnknownArticleNumbers(content, legalContext.articles);
    const guardedContent = ensureOriginalGuardrails(outputGuard.ok ? content : outputGuard.message, legalContext.articles.length);
    await recordOriginalHakeemAiAudit(input.actorId, requestId, provider, true, "ORIGINAL_HAKEEM_AI_COMPLETED", {
      requestedProvider,
      model,
      citations: legalContext.articles.length,
      mode: "server",
      tokenEstimate: Math.ceil((prompt.length + guardedContent.length) / 4)
    });
    return {
      ok: true,
      provider,
      model,
      content: guardedContent,
      warnings,
      mode: "server",
      requestId
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر استدعاء مزود الذكاء الاصطناعي.";
    await recordOriginalHakeemAiAudit(input.actorId, requestId, provider, false, "ORIGINAL_HAKEEM_AI_FAILED", {
      requestedProvider,
      error: message
    });
    return {
      ok: false,
      provider,
      model: resolveOriginalModel(provider, input.model),
      content: "",
      warnings: [...warnings, message],
      mode: "server",
      requestId
    };
  }
}

/**
 * تمرير أمين (raw) يستخدم مفتاح الإعداد المركزي مع نصوص المستدعي نفسها
 * (system + user) دون فرض قالب قضائي — يستعمله القاضي التفاعلي لكل أدواره
 * عبر مفتاح خادمي واحد بدل مفاتيح المتصفح. سقوط إلى offline عند غياب المفتاح.
 */
export async function callCentralProvider(input: { systemPrompt?: string; userPrompt: string; maxTokens?: number }): Promise<{ ok: boolean; content: string; mode: "server" | "offline"; provider: string }> {
  const cfg = await resolveAiConfig();
  if (cfg.provider === "offline" || !cfg.apiKey) {
    return { ok: false, content: "", mode: "offline", provider: "offline" };
  }
  const model = resolveOriginalModel(cfg.provider, cfg.model || undefined);
  const maxTokens = Math.min(Math.max(input.maxTokens ?? 1000, 1), 4096);
  const system = (input.systemPrompt ?? "").trim();
  const user = String(input.userPrompt ?? "");

  try {
    let content = "";
    if (cfg.provider === "openai" || cfg.provider === "custom") {
      const url = cfg.provider === "custom" && cfg.baseUrl ? `${cfg.baseUrl.replace(/\/$/, "")}/chat/completions` : "https://api.openai.com/v1/chat/completions";
      const messages = [...(system ? [{ role: "system", content: system }] : []), { role: "user", content: user }];
      const resp = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${cfg.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, max_tokens: maxTokens, messages, temperature: 0.2 })
      });
      if (!resp.ok) throw new Error(`provider ${resp.status}`);
      const data = (await resp.json()) as { choices?: Array<{ message?: { content?: string } }> };
      content = data.choices?.[0]?.message?.content || "";
    } else if (cfg.provider === "anthropic") {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": cfg.apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
        body: JSON.stringify({ model, max_tokens: maxTokens, ...(system ? { system } : {}), messages: [{ role: "user", content: user }] })
      });
      if (!resp.ok) throw new Error(`provider ${resp.status}`);
      const data = (await resp.json()) as { content?: Array<{ text?: string }> };
      content = data.content?.map((p) => p.text).filter(Boolean).join("\n") || "";
    } else if (cfg.provider === "gemini") {
      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(cfg.apiKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}), contents: [{ role: "user", parts: [{ text: user }] }], generationConfig: { maxOutputTokens: maxTokens, temperature: 0.2 } })
      });
      if (!resp.ok) throw new Error(`provider ${resp.status}`);
      const data = (await resp.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
      content = data.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join("\n") || "";
    }
    return { ok: Boolean(content), content, mode: "server", provider: cfg.provider };
  } catch {
    return { ok: false, content: "", mode: "server", provider: cfg.provider };
  }
}

async function callLiveProvider(provider: string, facts: string, citations: AiResult["citations"], cfg?: { apiKey?: string | null; baseUrl?: string | null }) {
  const system = [
    "أنت مساعد قانوني تعليمي لمنصة حكيم.",
    "لا تستشهد إلا بالمواد المرسلة داخل قائمة citations.",
    "لا تخترع مواد أو أرقام مواد.",
    "إذا لم تكف المواد فصرح بذلك.",
    "أعد تحليلاً عربيًا منظمًا مع التنبيه المهني."
  ].join("\n");
  const user = `الواقعة:\n${facts}\n\nالمواد المسموح بها فقط:\n${citations.map((item) => `- ${item.lawName}، المادة ${item.articleNumber}: ${item.quote}`).join("\n")}`;

  if (provider === "openai") {
    const key = cfg?.apiKey || process.env.OPENAI_API_KEY;
    if (!key) throw new Error("مفتاح OpenAI غير مضبوط.");
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
    const key = cfg?.apiKey || process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error("مفتاح Anthropic غير مضبوط.");
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

function normalizeOriginalProvider(provider: string) {
  if (provider === "openai" || provider === "anthropic" || provider === "gemini" || provider === "custom") return provider;
  return "offline";
}

function buildOriginalPrompt(input: OriginalHakeemAiInput) {
  const messageText = (input.messages || [])
    .map((message) => `${message.role || "user"}: ${message.content || ""}`)
    .join("\n");
  return [input.prompt, messageText].filter(Boolean).join("\n\n").trim() || "طلب محاكاة قضائية تدريبية داخل القاضي حكيم.";
}

function resolveOriginalModel(provider: string, requested?: string) {
  if (requested?.trim()) return requested.trim();
  if (provider === "openai") return process.env.OPENAI_MODEL || "gpt-4o-mini";
  if (provider === "anthropic") return process.env.ANTHROPIC_MODEL || "claude-3-5-haiku-latest";
  if (provider === "gemini") return process.env.GEMINI_MODEL || "gemini-1.5-flash";
  if (provider === "custom") return process.env.CUSTOM_AI_MODEL || "gpt-4o-mini";
  return "offline";
}

function buildOriginalSystemPrompt(legalContext: string) {
  return [
    "أنت القاضي حكيم داخل بيئة محاكاة قضائية تدريبية سعودية.",
    "أجب بالعربية وبأسلوب قضائي تدريبي منضبط.",
    "لا تعد المخرجات حكما قضائيا فعليا ولا رأيا قانونيا نهائيا.",
    "لا تختلق مواد نظامية أو أرقام مواد.",
    "إذا لم توجد مادة مناسبة في السياق النظامي فصرح بذلك نصا.",
    "السياق النظامي المسموح عند الحاجة للاستشهاد:",
    legalContext
  ].join("\n");
}

async function callOriginalProvider(provider: string, model: string, prompt: string, legalContext: string, cfg?: { apiKey?: string | null; baseUrl?: string | null }) {
  const system = buildOriginalSystemPrompt(legalContext);

  if (provider === "openai") {
    const key = cfg?.apiKey || process.env.OPENAI_API_KEY;
    if (!key) throw new Error("مفتاح OpenAI غير مضبوط.");
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt }
        ],
        temperature: 0.2
      })
    });
    if (!response.ok) throw new Error(`OpenAI ${response.status}`);
    const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return payload.choices?.[0]?.message?.content || "";
  }

  if (provider === "anthropic") {
    const key = cfg?.apiKey || process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error("مفتاح Anthropic غير مضبوط.");
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        max_tokens: 1600,
        system,
        messages: [{ role: "user", content: prompt }]
      })
    });
    if (!response.ok) throw new Error(`Anthropic ${response.status}`);
    const payload = (await response.json()) as { content?: Array<{ text?: string }> };
    return payload.content?.map((part) => part.text).filter(Boolean).join("\n") || "";
  }

  if (provider === "gemini") {
    const key = cfg?.apiKey || process.env.GEMINI_API_KEY;
    if (!key) throw new Error("مفتاح Gemini غير مضبوط.");
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2 }
      })
    });
    if (!response.ok) throw new Error(`Gemini ${response.status}`);
    const payload = (await response.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    return payload.candidates?.[0]?.content?.parts?.map((part) => part.text).filter(Boolean).join("\n") || "";
  }

  if (provider === "custom") {
    const baseUrl = cfg?.baseUrl || process.env.CUSTOM_AI_BASE_URL;
    const key = cfg?.apiKey || process.env.CUSTOM_AI_API_KEY;
    if (!baseUrl || !key) throw new Error("عنوان أو مفتاح المزوّد المخصّص غير مضبوط.");
    const endpoint = `${baseUrl.replace(/\/$/, "")}/chat/completions`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt }
        ],
        temperature: 0.2
      })
    });
    if (!response.ok) throw new Error(`Custom provider ${response.status}`);
    const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return payload.choices?.[0]?.message?.content || "";
  }

  return buildOriginalOfflineResponse(prompt, legalContext);
}

function ensureOriginalGuardrails(content: string, articleCount: number) {
  const fallback = articleCount === 0 ? "\n\nلم يتم العثور على مادة نظامية مطابقة في قاعدة البيانات الحالية." : "";
  const disclaimer = "\n\nتنبيه مهني: هذه المخرجات مساعدة تدريبية ولا تعد رأيا قانونيا نهائيا أو حكما قضائيا فعليا ولا تغني عن مراجعة محام مختص.";
  return `${content || "تعذر توليد مخرج مناسب."}${fallback}${content.includes("تنبيه") ? "" : disclaimer}`;
}

function buildOriginalOfflineResponse(prompt: string, legalContext: string) {
  return [
    "استجابة تدريبية من وضع offline في القاضي حكيم.",
    "",
    "ملخص الطلب:",
    prompt.slice(0, 1200),
    "",
    "السياق النظامي المتاح:",
    legalContext,
    "",
    "تنبيه مهني: هذه المخرجات مساعدة تدريبية ولا تعد رأيا قانونيا نهائيا أو حكما قضائيا فعليا ولا تغني عن مراجعة محام مختص."
  ].join("\n");
}

function sanitizeOutput(output: string, citations: AiResult["citations"], allowedArticles: LegalCoreResult[]) {
  const outputGuard = guardOutputAgainstUnknownArticleNumbers(output, allowedArticles);
  if (!outputGuard.ok) return offlineOutput(outputGuard.message, citations);
  const allowed = new Set(citations.map((item) => `${item.lawName}-${item.articleNumber}`));
  // يلتقط الأرقام العربية/اللاتينية وصيغة «فقرة/مادة» مثل (١/١٢٠) ويأخذ رقم المادة (الأكبر)
  const suspiciousArticleNumbers = [...output.matchAll(/(?:المادة|مادة)\s*\(?\s*([0-9٠-٩]+(?:\s*\/\s*[0-9٠-٩]+)*)\s*\)?/g)]
    .map((match) => parseArticleNumberCandidates(match[1])[0])
    .filter((n): n is number => Number.isFinite(n) && n > 0);
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

async function recordOriginalHakeemAiAudit(actorId: string | undefined, requestId: string, provider: string, success: boolean, action: string, metadata: Record<string, unknown>) {
  await auditEvent({
    actorId,
    subject: "AI_GATEWAY",
    action,
    metadata: {
      requestId,
      provider,
      success,
      module: "original-hakeem",
      ...metadata
    }
  }).catch(() => undefined);
}

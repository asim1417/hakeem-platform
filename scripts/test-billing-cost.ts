// اختبار حساب تكلفة المزوّد (المرحلة A) — نقيّ بلا قاعدة.
import {
  computeProviderCostMicrosUsd,
  extractAnthropicUsage,
  resolveSeedRate,
  type ModelRate,
} from "@/lib/modules/billing/model-pricing";

let pass = 0,
  fail = 0;
const T = (name: string, cond: boolean) => {
  console.log((cond ? "PASS" : "FAIL") + " :: " + name);
  cond ? pass++ : fail++;
};

const sonnet: ModelRate = {
  provider: "anthropic",
  model: "claude-sonnet-4-6",
  inputUsdPerMillion: 3,
  outputUsdPerMillion: 15,
  cacheWriteUsdPerMillion: 3.75,
  cacheReadUsdPerMillion: 0.3,
  webSearchUsdPerRequest: 0.01,
};

// 1M input @ $3 = $3 = 3,000,000 micros
T("1M input = 3,000,000 micros", computeProviderCostMicrosUsd({ inputTokens: 1_000_000, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0, webSearchCount: 0 }, sonnet) === 3_000_000);
// 1M output @ $15 = 15,000,000 micros
T("1M output = 15,000,000 micros", computeProviderCostMicrosUsd({ inputTokens: 0, outputTokens: 1_000_000, cacheCreationTokens: 0, cacheReadTokens: 0, webSearchCount: 0 }, sonnet) === 15_000_000);
// مزيج: 1000 in + 500 out = 0.003 + 0.0075 = 0.0105 USD = 10500 micros
T("1000 in + 500 out = 10,500 micros", computeProviderCostMicrosUsd({ inputTokens: 1000, outputTokens: 500, cacheCreationTokens: 0, cacheReadTokens: 0, webSearchCount: 0 }, sonnet) === 10_500);
// cache read 1M @ 0.3 = 300,000 micros
T("1M cache read = 300,000 micros", computeProviderCostMicrosUsd({ inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 1_000_000, webSearchCount: 0 }, sonnet) === 300_000);
// cache write 1M @ 3.75 = 3,750,000
T("1M cache write = 3,750,000 micros", computeProviderCostMicrosUsd({ inputTokens: 0, outputTokens: 0, cacheCreationTokens: 1_000_000, cacheReadTokens: 0, webSearchCount: 0 }, sonnet) === 3_750_000);
// web search 5 @ 0.01 = 0.05 = 50,000 micros
T("5 web searches = 50,000 micros", computeProviderCostMicrosUsd({ inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0, webSearchCount: 5 }, sonnet) === 50_000);
// صفر = صفر
T("صفر استخدام = 0", computeProviderCostMicrosUsd({ inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0, webSearchCount: 0 }, sonnet) === 0);
// قيم سالبة تُقصّ إلى صفر
T("قيم سالبة تُعامَل صفرًا", computeProviderCostMicrosUsd({ inputTokens: -100, outputTokens: -100, cacheCreationTokens: -1, cacheReadTokens: -1, webSearchCount: -1 }, sonnet) === 0);

// ── extractAnthropicUsage ──
const u = extractAnthropicUsage({
  input_tokens: 1200,
  output_tokens: 800,
  cache_creation_input_tokens: 300,
  cache_read_input_tokens: 5000,
  server_tool_use: { web_search_requests: 2 },
});
T("extract: input=1200", u.inputTokens === 1200);
T("extract: output=800", u.outputTokens === 800);
T("extract: cacheCreation=300", u.cacheCreationTokens === 300);
T("extract: cacheRead=5000", u.cacheReadTokens === 5000);
T("extract: webSearch=2", u.webSearchCount === 2);
T("extract: كائن فارغ = أصفار", (() => { const e = extractAnthropicUsage(undefined); return e.inputTokens === 0 && e.outputTokens === 0 && e.webSearchCount === 0; })());

// ── resolveSeedRate (مطابقة العائلة) ──
T("resolveSeedRate opus", resolveSeedRate("claude-opus-4-6").outputUsdPerMillion === 75);
T("resolveSeedRate haiku", resolveSeedRate("claude-3-5-haiku-latest").inputUsdPerMillion === 0.8);
T("resolveSeedRate عائلة sonnet لغير معروف", resolveSeedRate("claude-sonnet-9-xyz").inputUsdPerMillion === 3);
T("resolveSeedRate غير معروف كليًا = سقوط افتراضي", resolveSeedRate("gpt-foo").inputUsdPerMillion === 3);

console.log(`\n${pass} PASS / ${fail} FAIL`);
if (fail) process.exit(1);

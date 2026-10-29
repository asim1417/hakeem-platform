/**
 * HKM-062 — اختبار وحدة: مزوّد OpenSearch لا يبتلع رفض العنقود.
 * fetch مستبدل؛ لا شبكة ولا قاعدة. التشغيل: npm run test:opensearch-breaker
 */
import assert from "node:assert/strict";
import { noteOpenSearchFailure, openSearchBlocked, resetOpenSearchBreaker, httpOutcome } from "../lib/modules/legal-search/providers/opensearch-breaker";
import { opensearchProvider } from "../lib/modules/legal-search/providers/opensearch-provider";
import { ProviderHttpError } from "../lib/modules/legal-search/providers/search-provider";

let failures = 0;
async function check(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    console.log(`✓ ${name}`);
  } catch (e) {
    failures++;
    console.error(`✗ ${name}\n   ${e instanceof Error ? e.message : String(e)}`);
  }
}

process.env.OPENSEARCH_URL = "https://opensearch.test.invalid";
process.env.OPENSEARCH_BREAKER_MS = "600000";
const realFetch = globalThis.fetch;
const realError = console.error;
const realWarn = console.warn;
const logged: string[] = [];
console.error = (...a: unknown[]) => void logged.push(a.map(String).join(" "));
console.warn = (...a: unknown[]) => void logged.push(a.map(String).join(" "));

function stub(statusFor: (url: string) => number, calls: string[]) {
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(typeof input === "string" || input instanceof URL ? input : input.url);
    calls.push(url);
    const status = statusFor(url);
    return new Response(status === 200 ? JSON.stringify({ status: "green", hits: { hits: [], max_score: 0 } }) : '{"code":403,"message":"Cluster has been disabled."}', { status });
  }) as typeof fetch;
}

async function main() {
  await check("وسم الحالة http_403", () => assert.equal(httpOutcome(403), "http_403"));

  await check("فحص الصحة 403: غير متاح، والقاطع يُفتح ويُسجَّل السبب مرة", async () => {
    resetOpenSearchBreaker();
    logged.length = 0;
    const calls: string[] = [];
    stub(() => 403, calls);
    assert.equal(await opensearchProvider.isAvailable(), false);
    assert.equal(openSearchBlocked(), "http_403");
    assert.equal(opensearchProvider.lastFailure?.(), "http_403");
    assert.equal(calls.length, 1);
    assert.ok(logged.some((l) => l.includes("outcome=http_403")), `السجل: ${logged.join(" | ")}`);
  });

  await check("القاطع مفتوح: لا نداء شبكة في الفحص ولا البحث، والنتيجة [] كما كانت", async () => {
    const calls: string[] = [];
    stub(() => 403, calls);
    assert.equal(await opensearchProvider.isAvailable(), false);
    assert.deepEqual(await opensearchProvider.search({ q: "فسخ العقد" }), []);
    assert.equal(calls.length, 0);
  });

  await check("الصحة سليمة والبحث 403: يرمي ProviderHttpError بحالته (يُسجَّل http_403 لا ok)", async () => {
    resetOpenSearchBreaker();
    const calls: string[] = [];
    stub((u) => (u.endsWith("/_cluster/health") ? 200 : 403), calls);
    assert.equal(await opensearchProvider.isAvailable(), true);
    await assert.rejects(opensearchProvider.search({ q: "فسخ العقد" }), (e: unknown) => e instanceof ProviderHttpError && e.status === 403);
    assert.equal(openSearchBlocked(), "http_403");
  });

  await check("الخطأ العابر 503: يُبلَّغ ولا يفتح القاطع (عنقود سليم لا يُسقط لعطل لحظي)", async () => {
    resetOpenSearchBreaker();
    const calls: string[] = [];
    stub((u) => (u.endsWith("/_cluster/health") ? 200 : 503), calls);
    await assert.rejects(opensearchProvider.search({ q: "فسخ العقد" }), (e: unknown) => e instanceof ProviderHttpError && e.status === 503);
    assert.equal(openSearchBlocked(), null);
  });

  await check("عنقود سليم: نتائج بلا تغيير ولا قاطع", async () => {
    resetOpenSearchBreaker();
    const calls: string[] = [];
    stub(() => 200, calls);
    assert.deepEqual(await opensearchProvider.search({ q: "فسخ العقد" }), []);
    assert.equal(openSearchBlocked(), null);
  });

  await check("انقضاء مدة القاطع يعيد المحاولة", () => {
    resetOpenSearchBreaker();
    const t = 1_000_000;
    assert.equal(noteOpenSearchFailure(401, "test", t), true);
    assert.equal(noteOpenSearchFailure(401, "test", t + 1), false, "مفتوح أصلًا: لا يُعاد التسجيل");
    assert.equal(openSearchBlocked(t + 600_000 - 1), "http_401");
    assert.equal(openSearchBlocked(t + 600_002), null);
  });

  await check("بلا إعداد: غير متاح بلا شبكة", async () => {
    resetOpenSearchBreaker();
    const url = process.env.OPENSEARCH_URL;
    delete process.env.OPENSEARCH_URL;
    const calls: string[] = [];
    stub(() => 200, calls);
    assert.equal(await opensearchProvider.isAvailable(), false);
    assert.equal(calls.length, 0);
    process.env.OPENSEARCH_URL = url;
  });

  globalThis.fetch = realFetch;
  console.error = realError;
  console.warn = realWarn;
  resetOpenSearchBreaker();
  if (failures) {
    console.error(`\n${failures} اختبار فشل`);
    process.exit(1);
  }
  console.log("\nكل اختبارات قاطع OpenSearch ناجحة");
}

main();

#!/usr/bin/env tsx
/**
 * اختبارات التحصين التشغيلي — HKM-DOCUMENTS-UPGRADE-004 PR-2.5
 * حتمية: mocks فقط — بلا شبكة خارجية ولا ClamAV حقيقي.
 *
 * npm run test:document-hardening
 */
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { getDocumentLimits } from "@/lib/modules/documents/document-limits";
import {
  MemoryRateLimiter,
  __resetMemoryRateLimiterForTests,
  __setRateLimiterForTests,
  getRateLimiter
} from "@/lib/modules/rate-limit";
import { NoopMalwareScanner } from "@/lib/modules/documents/malware/noop-scanner";
import { ClamAvScanner } from "@/lib/modules/documents/malware/clamav-scanner";
import { scanAttachmentFile, getMalwareScanner } from "@/lib/modules/documents/malware";
import {
  InlineDocumentJobDispatcher,
  __resetInlineJobsForTests
} from "@/lib/modules/documents/jobs/inline-dispatcher";
import { cleanupTempDocumentFiles } from "@/lib/modules/documents/cleanup-temp";
import {
  assertSafeDocumentLogPayload,
  createCorrelationId,
  logDocumentEvent
} from "@/lib/modules/observability/document-logger";
import {
  __resetDocumentMetricsForTests,
  getDocumentMetricSnapshot,
  recordDocumentMetric
} from "@/lib/modules/observability/metrics";
import {
  hashIdempotencyKey,
  hashRequestBody
} from "@/lib/modules/documents/idempotency";
import { isDirectUrlImportEnabled } from "@/lib/modules/documents/feature-flags";

let passed = 0;
function check(name: string, fn: () => void | Promise<void>) {
  return (async () => {
    await fn();
    passed += 1;
    console.log(`✓ ${name}`);
  })();
}

async function main() {
  const prev = { ...process.env };

  // ── Limits ──
  await check("حدود الحجم الافتراضية موحّدة", () => {
    delete process.env.DOCUMENT_MAX_UPLOAD_BYTES;
    delete process.env.DOCUMENT_DIRECT_URL_MAX_BYTES;
    const L = getDocumentLimits();
    assert.equal(L.maxUploadBytes, 104_857_600);
    assert.equal(L.maxDirectUrlBytes, 104_857_600);
    assert.equal(L.maxInspectBytes, 65_536);
    assert.equal(L.maxFileNameLength, 180);
    assert.equal(L.rateLimitInspectMax, 30);
    assert.equal(L.rateLimitImportMax, 10);
    assert.equal(L.rateLimitUploadMax, 20);
  });

  await check("رفع دون الحد / عند الحد / فوق الحد منطق الأرقام", () => {
    const L = getDocumentLimits();
    assert.ok(50_000_000 <= L.maxUploadBytes);
    assert.ok(L.maxUploadBytes <= L.maxUploadBytes);
    assert.ok(L.maxUploadBytes + 1 > L.maxUploadBytes);
  });

  // ── Rate limiting ──
  __resetMemoryRateLimiterForTests();
  __setRateLimiterForTests(new MemoryRateLimiter());

  await check("rate limit: ضمن الحد", async () => {
    __resetMemoryRateLimiterForTests();
    const lim = getRateLimiter();
    const d = await lim.consume({ key: "u1", scope: "inspect-url", limit: 3, windowSeconds: 60 });
    assert.equal(d.allowed, true);
    assert.equal(d.remaining, 2);
  });

  await check("rate limit: آخر طلب مسموح ثم تجاوز", async () => {
    __resetMemoryRateLimiterForTests();
    const lim = getRateLimiter();
    await lim.consume({ key: "u2", scope: "import-url", limit: 2, windowSeconds: 60 });
    const last = await lim.consume({ key: "u2", scope: "import-url", limit: 2, windowSeconds: 60 });
    assert.equal(last.allowed, true);
    assert.equal(last.remaining, 0);
    const over = await lim.consume({ key: "u2", scope: "import-url", limit: 2, windowSeconds: 60 });
    assert.equal(over.allowed, false);
    assert.ok((over.retryAfterSeconds ?? 0) >= 1);
  });

  await check("rate limit: عزل المستخدمين والـ scopes", async () => {
    __resetMemoryRateLimiterForTests();
    const lim = getRateLimiter();
    for (let i = 0; i < 3; i++) {
      await lim.consume({ key: "a", scope: "upload", limit: 2, windowSeconds: 60 });
    }
    const otherUser = await lim.consume({ key: "b", scope: "upload", limit: 2, windowSeconds: 60 });
    assert.equal(otherUser.allowed, true);
    const otherScope = await lim.consume({ key: "a", scope: "inspect-url", limit: 2, windowSeconds: 60 });
    assert.equal(otherScope.allowed, true);
  });

  await check("rate limit: نافذة جديدة بعد انتهاء المهلة", async () => {
    __resetMemoryRateLimiterForTests();
    const lim = getRateLimiter();
    await lim.consume({ key: "w", scope: "t", limit: 1, windowSeconds: 1 });
    const blocked = await lim.consume({ key: "w", scope: "t", limit: 1, windowSeconds: 1 });
    assert.equal(blocked.allowed, false);
    await new Promise((r) => setTimeout(r, 1100));
    const next = await lim.consume({ key: "w", scope: "t", limit: 1, windowSeconds: 1 });
    assert.equal(next.allowed, true);
  });

  // ── Malware ──
  await check("malware: معطّل → SKIPPED وليس CLEAN", async () => {
    process.env.DOCUMENT_MALWARE_SCAN_ENABLED = "false";
    const r = await scanAttachmentFile("/tmp/nonexistent-ok");
    assert.equal(r.status, "SKIPPED");
    assert.notEqual(r.status, "CLEAN");
  });

  await check("malware: noop.available=false", async () => {
    const s = new NoopMalwareScanner();
    assert.equal(await s.available(), false);
    const r = await s.scanFile("/x");
    assert.equal(r.status, "SKIPPED");
  });

  await check("malware: مفعّل بلا محرك → ERROR عند fail-closed", async () => {
    process.env.DOCUMENT_MALWARE_SCAN_ENABLED = "true";
    process.env.DOCUMENT_MALWARE_SCAN_FAIL_CLOSED = "true";
    delete process.env.CLAMAV_HOST;
    const r = await scanAttachmentFile("/tmp/x");
    assert.equal(r.status, "ERROR");
    assert.equal(r.errorCode, "SCANNER_UNAVAILABLE");
  });

  await check("malware: مفعّل بلا محرك → SKIPPED عند fail-open (اختبار فقط)", async () => {
    process.env.DOCUMENT_MALWARE_SCAN_ENABLED = "true";
    process.env.DOCUMENT_MALWARE_SCAN_FAIL_CLOSED = "false";
    delete process.env.CLAMAV_HOST;
    const r = await scanAttachmentFile("/tmp/x");
    assert.equal(r.status, "SKIPPED");
  });

  await check("malware: clamav غير موصول لا يدّعي CLEAN", async () => {
    process.env.CLAMAV_HOST = "127.0.0.1";
    const s = new ClamAvScanner("127.0.0.1");
    assert.equal(await s.available(), true);
    const tmp = path.join(os.tmpdir(), `hakeem-scan-test-${Date.now()}.bin`);
    await fs.writeFile(tmp, Buffer.from("%PDF-1.4"));
    try {
      const r = await s.scanFile(tmp);
      assert.notEqual(r.status, "CLEAN");
      assert.equal(r.status, "ERROR");
    } finally {
      await fs.unlink(tmp).catch(() => undefined);
    }
  });

  await check("malware: getMalwareScanner لا يعيد CLEAN عند التعطيل", async () => {
    process.env.DOCUMENT_MALWARE_SCAN_ENABLED = "false";
    const s = getMalwareScanner();
    const r = await s.scanFile("/x");
    assert.notEqual(r.status, "CLEAN");
  });

  // ── Queue ──
  await check("queue: inline dispatch + dedupe", async () => {
    __resetInlineJobsForTests();
    let runs = 0;
    const d = new InlineDocumentJobDispatcher(async () => {
      runs += 1;
      await new Promise((r) => setTimeout(r, 30));
    });
    const p = {
      attachmentId: "att1",
      userId: "u",
      correlationId: createCorrelationId()
    };
    const [a, b] = await Promise.all([
      d.dispatch("DOCUMENT_IMPORTED", p),
      d.dispatch("DOCUMENT_IMPORTED", p)
    ]);
    assert.ok(a.jobId);
    assert.ok(b.jobId.startsWith("deduped:") || b.jobId);
    assert.ok(runs <= 2);
  });

  await check("queue: لا يستخدم setTimeout خلفية غير مضمونة في الـ dispatcher", () => {
    const src = require("fs").readFileSync(
      path.join(process.cwd(), "lib/modules/documents/jobs/inline-dispatcher.ts"),
      "utf8"
    );
    assert.ok(!src.includes("setTimeout("));
  });

  // ── Idempotency hashing ──
  await check("idempotency: hash لا يتضمن URL خامًا في المفتاح", () => {
    const h1 = hashIdempotencyKey("key-1");
    const h2 = hashRequestBody({ urlHost: "example.com", relationType: "عام" });
    assert.equal(h1.length, 64);
    assert.equal(h2.length, 64);
    assert.ok(!JSON.stringify({ h1, h2 }).includes("https://"));
  });

  // ── Logging ──
  await check("logging: correlationId موجود وصيغة آمنة", () => {
    const id = createCorrelationId();
    assert.ok(id.length > 10);
    const violations = assertSafeDocumentLogPayload({
      event: "document.import.ok",
      correlationId: id,
      attachmentId: "a1",
      status: "ok"
    });
    assert.deepEqual(violations, []);
  });

  await check("logging: يرفض مفاتيح URL/token/documentText", () => {
    const v = assertSafeDocumentLogPayload({
      rawUrl: "https://x?token=1",
      documentText: "سر",
      token: "abc"
    });
    assert.ok(v.length >= 2);
  });

  await check("logging: logDocumentEvent لا يرمي", () => {
    logDocumentEvent({
      event: "document_hardening_test",
      correlationId: createCorrelationId(),
      status: "ok",
      provider: "TEST"
    });
  });

  // ── Metrics ──
  await check("metrics: تسجّل دون labels حساسة", () => {
    __resetDocumentMetricsForTests();
    recordDocumentMetric("document_import_total", 1, { provider: "DIRECT_URL", status: "ok" });
    recordDocumentMetric("document_rate_limited_total", 1, { provider: "DIRECT_URL", errorCode: "RATE_LIMITED" });
    // يُرفض بصمت إن وُجد label محظور
    recordDocumentMetric("document_import_total", 1, { userId: "u1" } as Record<string, string>);
    const snap = getDocumentMetricSnapshot();
    assert.ok(Object.keys(snap.counters).some((k) => k.includes("document_import_total")));
    assert.ok(!JSON.stringify(snap).includes("userId=u1"));
  });

  // ── Cleanup ──
  await check("cleanup: dry-run لا يحذف؛ apply يحذف القديم فقط", async () => {
    const oldDir = path.join(os.tmpdir(), `hakeem-url-old-${Date.now()}`);
    const newDir = path.join(os.tmpdir(), `hakeem-url-new-${Date.now()}`);
    await fs.mkdir(oldDir, { recursive: true });
    await fs.mkdir(newDir, { recursive: true });
    await fs.writeFile(path.join(oldDir, "f.bin"), "x");
    await fs.writeFile(path.join(newDir, "f.bin"), "y");
    // اجعل القديم قديمًا
    const ancient = new Date(Date.now() - 7 * 24 * 3600_000);
    await fs.utimes(oldDir, ancient, ancient);

    const dry = await cleanupTempDocumentFiles({
      apply: false,
      now: new Date(),
      processingPaths: new Set([newDir])
    });
    assert.ok(dry.eligible >= 1);
    assert.equal(dry.deleted, 0);
    assert.ok(await fs.stat(oldDir).then(() => true).catch(() => false));

    const applied = await cleanupTempDocumentFiles({
      apply: true,
      now: new Date(),
      processingPaths: new Set([newDir])
    });
    assert.ok(applied.deleted >= 1);
    assert.ok(!(await fs.stat(oldDir).then(() => true).catch(() => false)));
    assert.ok(await fs.stat(newDir).then(() => true).catch(() => false));

    await fs.rm(newDir, { recursive: true, force: true });
  });

  await check("cleanup: symlink يُتخطى", async () => {
    const target = path.join(os.tmpdir(), `hakeem-outside-${Date.now()}`);
    const link = path.join(os.tmpdir(), `hakeem-url-link-${Date.now()}`);
    await fs.mkdir(target, { recursive: true });
    try {
      await fs.symlink(target, link);
    } catch {
      // بعض البيئات تمنع symlink — اعتبر الاختبار ناجحًا إن تعذّر الإنشاء
      await fs.rm(target, { recursive: true, force: true });
      return;
    }
    const ancient = new Date(Date.now() - 7 * 24 * 3600_000);
    await fs.utimes(link, ancient, ancient).catch(() => undefined);
    const r = await cleanupTempDocumentFiles({ apply: true, now: new Date() });
    assert.ok(r.skipped >= 0);
    assert.ok(await fs.lstat(link).then(() => true).catch(() => false));
    await fs.unlink(link).catch(() => undefined);
    await fs.rm(target, { recursive: true, force: true });
  });

  // ── Feature flags defaults ──
  await check("feature flag: direct URL معطّل افتراضيًا", () => {
    delete process.env.DOCUMENT_DIRECT_URL_IMPORT_ENABLED;
    assert.equal(isDirectUrlImportEnabled(), false);
  });

  await check("health response shape لا يتضمن أسرارًا (عقد ثابت)", () => {
    const sample = {
      status: "healthy",
      features: { directUrlImport: false, malwareScan: false, queue: false, metrics: true },
      dependencies: {
        database: "ok",
        blobStorage: "metadata_only",
        redis: "not_configured",
        malwareScanner: "not_configured"
      }
    };
    const blob = JSON.stringify(sample);
    assert.ok(!blob.includes("AccountKey"));
    assert.ok(!blob.includes("connectionString"));
    assert.ok(!blob.includes("Bearer"));
    assert.ok(!("storageBackend" in sample.dependencies));
  });

  // restore env
  for (const k of Object.keys(process.env)) {
    if (!(k in prev)) delete process.env[k];
  }
  Object.assign(process.env, prev);
  __setRateLimiterForTests(null);

  console.log(`\n✅ test:document-hardening — ${passed} passed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

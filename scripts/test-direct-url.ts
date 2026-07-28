/**
 * اختبارات استيراد الروابط المباشرة — HKM-DOCUMENTS-UPGRADE-003 PR-2
 * حتمية: DNS وHTTP قابلان للحقن — بلا شبكة خارجية.
 *
 * npm run test:direct-url
 */
import assert from "node:assert/strict";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import {
  assertUrlSafeForFetch,
  classifyIpAddress,
  toSafeDisplayUrl,
  urlContainsSensitiveQuery
} from "@/lib/modules/documents/url-security";
import { sniffAllowedMime, sniffMagicBytes } from "@/lib/modules/documents/mime-sniff";
import {
  fileNameFromContentDisposition,
  sanitizeFileName
} from "@/lib/modules/documents/filename";
import { detectProviderFromUrl } from "@/lib/modules/documents/connectors/provider-detector";
import {
  cleanupDownloadedFile,
  createDirectUrlConnector,
  DirectUrlError
} from "@/lib/modules/documents/connectors/direct-url";
import { isDirectUrlImportEnabled } from "@/lib/modules/documents/feature-flags";
import {
  __resetDirectUrlRateLimitForTests,
  consumeDirectUrlRateLimit
} from "@/lib/modules/documents/rate-limit";

let passed = 0;
function check(name: string, fn: () => void | Promise<void>) {
  return (async () => {
    await fn();
    passed += 1;
    console.log(`✓ ${name}`);
  })();
}

async function withMockServer(
  handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>,
  fn: (baseUrl: string) => Promise<void>
) {
  const server = createServer((req, res) => {
    void Promise.resolve(handler(req, res)).catch(() => {
      res.statusCode = 500;
      res.end("err");
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
  }
}

async function main() {
  // ── URL validation ──
  await check("HTTPS صحيح يمر بعد DNS عام", async () => {
    const r = await assertUrlSafeForFetch("https://example.com/a.pdf", {
      resolver: async () => ["93.184.216.34"]
    });
    assert.equal(r.allowed, true);
  });

  await check("HTTP مرفوض", async () => {
    const r = await assertUrlSafeForFetch("http://example.com/a.pdf");
    assert.equal(r.allowed, false);
    assert.equal(r.reasonCode, "HTTPS_REQUIRED");
  });

  await check("file:// مرفوض", async () => {
    const r = await assertUrlSafeForFetch("file:///etc/passwd");
    assert.equal(r.reasonCode, "HTTPS_REQUIRED");
  });

  await check("localhost مرفوض", async () => {
    assert.equal((await assertUrlSafeForFetch("https://localhost/x")).reasonCode, "LOCALHOST");
    assert.equal((await assertUrlSafeForFetch("https://foo.localhost/x")).reasonCode, "LOCALHOST");
  });

  await check("127.0.0.1 وloopback", async () => {
    assert.equal(classifyIpAddress("127.0.0.1"), "LOOPBACK");
    assert.equal((await assertUrlSafeForFetch("https://127.0.0.1/x")).reasonCode, "LOOPBACK");
  });

  await check("شبكات خاصة", async () => {
    assert.equal(classifyIpAddress("10.0.0.1"), "PRIVATE_IP");
    assert.equal(classifyIpAddress("172.16.0.1"), "PRIVATE_IP");
    assert.equal(classifyIpAddress("192.168.1.1"), "PRIVATE_IP");
    assert.equal((await assertUrlSafeForFetch("https://10.0.0.1/x")).reasonCode, "PRIVATE_IP");
  });

  await check("metadata وlink-local", async () => {
    assert.equal(classifyIpAddress("169.254.169.254"), "METADATA_ENDPOINT");
    assert.equal(classifyIpAddress("169.254.1.1"), "LINK_LOCAL");
    assert.equal(
      (await assertUrlSafeForFetch("https://metadata.google.internal/")).reasonCode,
      "METADATA_ENDPOINT"
    );
  });

  await check("IPv6 loopback وlink-local", async () => {
    assert.equal(classifyIpAddress("::1"), "LOOPBACK");
    assert.equal(classifyIpAddress("fe80::1"), "LINK_LOCAL");
  });

  await check("credentials في URL مرفوضة", async () => {
    const r = await assertUrlSafeForFetch("https://user:pass@example.com/a.pdf");
    assert.equal(r.reasonCode, "URL_CREDENTIALS_NOT_ALLOWED");
  });

  await check("منفذ 8080 مرفوض", async () => {
    const r = await assertUrlSafeForFetch("https://example.com:8080/a.pdf", {
      resolver: async () => ["93.184.216.34"]
    });
    assert.equal(r.reasonCode, "DISALLOWED_PORT");
  });

  await check("فشل DNS", async () => {
    const r = await assertUrlSafeForFetch("https://no-such-host.invalid/x", {
      resolver: async () => {
        throw new Error("ENOTFOUND");
      }
    });
    assert.equal(r.reasonCode, "DNS_RESOLUTION_FAILED");
  });

  await check("خليط public+private = DNS_REBINDING_RISK", async () => {
    const r = await assertUrlSafeForFetch("https://evil.example/x", {
      resolver: async () => ["93.184.216.34", "10.0.0.5"]
    });
    assert.equal(r.reasonCode, "DNS_REBINDING_RISK");
  });

  await check("DNS يحل لخاص", async () => {
    const r = await assertUrlSafeForFetch("https://intranet.example/x", {
      resolver: async () => ["192.168.1.10"]
    });
    assert.equal(r.reasonCode, "PRIVATE_IP");
  });

  // ── Redirects عبر موصل مع fetch/DNS محقونين ──
  await check("redirect إلى خاص يُرفض", async () => {
    const connector = createDirectUrlConnector({
      maxRedirects: 5,
      resolver: async (host) => {
        if (host === "public.example") return ["93.184.216.34"];
        if (host === "evil.internal") return ["10.0.0.8"];
        return ["93.184.216.34"];
      },
      fetchImpl: async (input) => {
        const url = String(input);
        if (url.includes("public.example") && !url.includes("final")) {
          return new Response(null, {
            status: 302,
            headers: { location: "https://evil.internal/secret" }
          });
        }
        return new Response("ok", { status: 200 });
      }
    });
    await assert.rejects(
      () => connector.inspect({ url: "https://public.example/doc.pdf" }),
      (e: unknown) => e instanceof DirectUrlError && e.code === "URL_BLOCKED"
    );
  });

  await check("أكثر من 5 redirects يُرفض", async () => {
    let n = 0;
    const connector = createDirectUrlConnector({
      maxRedirects: 5,
      resolver: async () => ["93.184.216.34"],
      fetchImpl: async () => {
        n += 1;
        return new Response(null, {
          status: 302,
          headers: { location: `https://cdn.example/hop${n}` }
        });
      }
    });
    await assert.rejects(
      () => connector.inspect({ url: "https://cdn.example/start" }),
      (e: unknown) => e instanceof DirectUrlError && e.code === "TOO_MANY_REDIRECTS"
    );
  });

  await check("https → http redirect مرفوض", async () => {
    const connector = createDirectUrlConnector({
      resolver: async () => ["93.184.216.34"],
      fetchImpl: async () =>
        new Response(null, { status: 302, headers: { location: "http://cdn.example/x" } })
    });
    await assert.rejects(
      () => connector.inspect({ url: "https://cdn.example/start" }),
      (e: unknown) => e instanceof DirectUrlError && e.code === "URL_BLOCKED"
    );
  });

  // ── MIME ──
  await check("PDF magic bytes", async () => {
    const pdf = Buffer.from("%PDF-1.4\n%âãÏÓ\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n");
    assert.equal(sniffMagicBytes(pdf), "application/pdf");
    const r = await sniffAllowedMime(pdf, "application/pdf");
    assert.equal(r.ok, true);
  });

  await check("PNG وJPEG", async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    assert.equal(sniffMagicBytes(png), "image/png");
    const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
    assert.equal(sniffMagicBytes(jpg), "image/jpeg");
  });

  await check("HTML متنكر كـPDF يُرفض", async () => {
    const html = Buffer.from("<!DOCTYPE html><html><head></head><body>login</body></html>");
    const r = await sniffAllowedMime(html, "application/pdf");
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reasonCode, "REMOTE_CONTENT_NOT_A_FILE");
  });

  await check("TXT مقبول", async () => {
    const r = await sniffAllowedMime(Buffer.from("مادة أولى من النظام"), "text/plain");
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.detectedMimeType, "text/plain");
  });

  // ── Download streaming مع حد الحجم ──
  await check("تنزيل PDF عبر mock fetch + حد الحجم مع Content-Length", async () => {
    const pdf = Buffer.from("%PDF-1.4\nhello\n%%EOF\n");
    const connector = createDirectUrlConnector({
      maxBytes: 10,
      resolver: async () => ["93.184.216.34"],
      fetchImpl: async () =>
        new Response(pdf, {
          status: 200,
          headers: {
            "content-type": "application/pdf",
            "content-length": String(pdf.length),
            "content-disposition": 'attachment; filename="ok.pdf"'
          }
        })
    });
    await assert.rejects(
      () => connector.download({ url: "https://files.example/ok.pdf" }),
      (e: unknown) => e instanceof DirectUrlError && e.code === "FILE_TOO_LARGE"
    );
  });

  await check("تنزيل ناجح + SHA-256 + cleanup", async () => {
    const pdf = Buffer.from("%PDF-1.4\ncontent\n%%EOF\n");
    const connector = createDirectUrlConnector({
      maxBytes: 10_000,
      resolver: async () => ["93.184.216.34"],
      fetchImpl: async () =>
        new Response(pdf, {
          status: 200,
          headers: {
            "content-type": "application/pdf",
            "content-disposition": "attachment; filename*=UTF-8''%D9%88%D8%AB%D9%8A%D9%82%D8%A9.pdf"
          }
        })
    });
    const file = await connector.download({ url: "https://files.example/doc.pdf" });
    assert.equal(file.detectedMimeType, "application/pdf");
    assert.ok(file.sha256.length === 64);
    assert.ok(file.fileName.includes("وثيقة") || file.fileName.endsWith(".pdf"));
    await cleanupDownloadedFile(file);
  });

  await check("تجاوز الحجم أثناء البث بلا Content-Length", async () => {
    const big = Buffer.alloc(200, 0x41);
    // اجعل الرأس يبدو كنص
    big.write("hello world plain text file\n");
    const connector = createDirectUrlConnector({
      maxBytes: 50,
      resolver: async () => ["93.184.216.34"],
      fetchImpl: async () =>
        new Response(big, {
          status: 200,
          headers: { "content-type": "text/plain" }
        })
    });
    await assert.rejects(
      () => connector.download({ url: "https://files.example/big.txt" }),
      (e: unknown) => e instanceof DirectUrlError && e.code === "FILE_TOO_LARGE"
    );
  });

  // ── Filename ──
  await check("اسم ملف خبيث يُنظَّف", () => {
    assert.equal(sanitizeFileName("../../etc/passwd"), "passwd");
    assert.equal(sanitizeFileName("a\\b\\c.pdf"), "c.pdf");
    assert.ok(!sanitizeFileName("ok\u0000.pdf").includes("\u0000"));
  });

  await check("Content-Disposition عربي UTF-8", () => {
    const name = fileNameFromContentDisposition("attachment; filename*=UTF-8''%D9%85%D8%B0%D9%83%D8%B1%D8%A9.pdf");
    assert.ok(name && name.includes("مذكرة"));
  });

  // ── Provider detector ──
  await check("كاشف المزوّد يؤجّل Google/Microsoft", () => {
    assert.equal(detectProviderFromUrl("https://drive.google.com/file/d/x"), "GOOGLE_DRIVE");
    assert.equal(detectProviderFromUrl("https://contoso.sharepoint.com/x"), "MICROSOFT_SHAREPOINT");
    assert.equal(detectProviderFromUrl("https://cdn.example/a.pdf"), "DIRECT_URL");
  });

  // ── Feature flag & rate limit ──
  await check("feature flag افتراضيًا معطّل", () => {
    delete process.env.DOCUMENT_DIRECT_URL_IMPORT_ENABLED;
    assert.equal(isDirectUrlImportEnabled(), false);
    process.env.DOCUMENT_DIRECT_URL_IMPORT_ENABLED = "true";
    assert.equal(isDirectUrlImportEnabled(), true);
    delete process.env.DOCUMENT_DIRECT_URL_IMPORT_ENABLED;
  });

  await check("rate limit يمنع الإغراق", () => {
    __resetDirectUrlRateLimitForTests();
    for (let i = 0; i < 30; i += 1) {
      assert.equal(consumeDirectUrlRateLimit("t", 30).allowed, true);
    }
    assert.equal(consumeDirectUrlRateLimit("t", 30).allowed, false);
  });

  await check("safeDisplayUrl يحذف query", () => {
    assert.equal(toSafeDisplayUrl("https://x.com/a.pdf?token=secret#h"), "https://x.com/a.pdf");
    assert.equal(urlContainsSensitiveQuery("https://x.com/a?X-Amz-Signature=1"), true);
  });

  // mock server محلي يُثبت أن الاختبارات لا تحتاج إنترنت — المنطق نفسه يرفض 127 عبر SSRF
  await check("خادم محلي موجود لكن SSRF يرفضه قبل الاتصال عند استخدام HTTPS+DNS خاص", async () => {
    await withMockServer(
      (_req, res) => {
        res.end("%PDF-1.4");
      },
      async () => {
        const r = await assertUrlSafeForFetch("https://127.0.0.1/x");
        assert.equal(r.allowed, false);
      }
    );
  });

  console.log(`\nكل اختبارات direct-url ناجحة (${passed})`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

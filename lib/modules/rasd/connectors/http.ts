import { readFile } from "fs/promises";
import { fileURLToPath } from "url";
import { RASD_FIXTURES_ONLY, RASD_USER_AGENT, envBool } from "../flags";
import type { FetchResult } from "../types";
import {
  RASD_DEFAULT_TIMEOUT_MS,
  RASD_MAX_REDIRECTS,
  RASD_MAX_RESPONSE_BYTES,
  assertSafeRasdUrl,
  rasdFetchLogSafe,
  sanitizeOutboundHeaders
} from "./url-guard";

export interface RasdFetchOptions {
  method?: "GET" | "HEAD";
  headers?: Record<string, string>;
  timeoutMs?: number;
  /** مسار fixture محلي فقط — لا يمر عبر الشبكة. */
  fixturePath?: string;
  includeBuffer?: boolean;
  /** يسمح بـ file:// للاختبارات/fixtures فقط عندما تُمرَّر صراحة. */
  allowFixtureFileUrl?: boolean;
}

function headersToRecord(headers: Headers): Record<string, string> {
  const record: Record<string, string> = {};
  headers.forEach((value, key) => {
    record[key.toLowerCase()] = value;
  });
  return record;
}

async function fetchFixture(pathOrUrl: string): Promise<FetchResult> {
  try {
    const path = pathOrUrl.startsWith("file://") ? fileURLToPath(pathOrUrl) : pathOrUrl;
    const buffer = await readFile(path);
    if (buffer.byteLength > RASD_MAX_RESPONSE_BYTES) {
      return {
        ok: false,
        status: 0,
        headers: {},
        bodyText: "",
        error: `تجاوز حجم الـ fixture الحد الأقصى (${RASD_MAX_RESPONSE_BYTES} بايت)`
      };
    }
    return {
      ok: true,
      status: 200,
      headers: {},
      bodyText: buffer.toString("utf8"),
      bodyBuffer: buffer
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      headers: {},
      bodyText: "",
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function readLimitedBody(response: Response): Promise<{ buffer: Buffer; truncated: boolean }> {
  const contentLength = Number(response.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > RASD_MAX_RESPONSE_BYTES) {
    throw new Error(`Content-Length يتجاوز الحد الأقصى (${RASD_MAX_RESPONSE_BYTES})`);
  }

  if (!response.body) {
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (buffer.byteLength > RASD_MAX_RESPONSE_BYTES) {
      throw new Error(`حجم الاستجابة يتجاوز الحد الأقصى (${RASD_MAX_RESPONSE_BYTES})`);
    }
    return { buffer, truncated: false };
  }

  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = Buffer.from(value);
    total += chunk.byteLength;
    if (total > RASD_MAX_RESPONSE_BYTES) {
      try {
        await reader.cancel("size_limit");
      } catch {
        // ignore
      }
      throw new Error(`حجم الاستجابة يتجاوز الحد الأقصى (${RASD_MAX_RESPONSE_BYTES})`);
    }
    chunks.push(chunk);
  }
  return { buffer: Buffer.concat(chunks), truncated: false };
}

/**
 * جلب آمن لمحرك رصد:
 * - HTTPS فقط + allowlist نطاقات رسمية
 * - إعادة فحص كل redirect يدويًا
 * - حد حجم/مهلة
 * - لا cookies/authorization
 */
export async function rasdFetch(url: string, opts: RasdFetchOptions = {}): Promise<FetchResult> {
  if (opts.fixturePath) {
    return fetchFixture(opts.fixturePath);
  }

  if (url.startsWith("file://")) {
    if (opts.allowFixtureFileUrl || envBool("RASD_FIXTURES_ONLY", RASD_FIXTURES_ONLY)) {
      return fetchFixture(url);
    }
    return {
      ok: false,
      status: 0,
      headers: {},
      bodyText: "",
      error: "file:// غير مسموح خارج وضع fixtures.",
      ...{ meta: rasdFetchLogSafe(url, 0, "FILE_FORBIDDEN") }
    };
  }

  if (envBool("RASD_FIXTURES_ONLY", RASD_FIXTURES_ONLY)) {
    return {
      ok: false,
      status: 0,
      headers: {},
      bodyText: "",
      error: "RASD_FIXTURES_ONLY is enabled and no fixturePath/file:// URL was supplied"
    };
  }

  let current = url;
  for (let hop = 0; hop <= RASD_MAX_REDIRECTS; hop += 1) {
    const safety = await assertSafeRasdUrl(current);
    if (!safety.ok) {
      return {
        ok: false,
        status: 0,
        headers: {},
        bodyText: "",
        error: `${safety.code}: ${safety.error}`
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? RASD_DEFAULT_TIMEOUT_MS);
    try {
      const response = await fetch(safety.url.toString(), {
        method: opts.method ?? "GET",
        headers: {
          "User-Agent": RASD_USER_AGENT,
          Accept: "text/html,application/xhtml+xml,application/xml,application/pdf,text/plain;q=0.9,*/*;q=0.8",
          ...sanitizeOutboundHeaders(opts.headers)
        },
        signal: controller.signal,
        redirect: "manual"
      });

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        if (!location) {
          return {
            ok: false,
            status: response.status,
            headers: headersToRecord(response.headers),
            bodyText: "",
            error: "redirect بدون Location"
          };
        }
        if (hop === RASD_MAX_REDIRECTS) {
          return {
            ok: false,
            status: response.status,
            headers: headersToRecord(response.headers),
            bodyText: "",
            error: `تجاوز الحد الأقصى للتحويلات (${RASD_MAX_REDIRECTS})`
          };
        }
        current = new URL(location, safety.url).toString();
        continue;
      }

      const headers = headersToRecord(response.headers);
      const contentType = headers["content-type"] ?? "";
      const { buffer } = await readLimitedBody(response);
      const isText = /^text\/|json|xml|html|xhtml/i.test(contentType);

      return {
        ok: response.ok,
        status: response.status,
        headers,
        bodyText: isText || !contentType ? buffer.toString("utf8") : "",
        bodyBuffer: opts.includeBuffer || !isText ? buffer : undefined,
        etag: headers.etag,
        lastModified: headers["last-modified"]
      };
    } catch (error) {
      return {
        ok: false,
        status: 0,
        headers: {},
        bodyText: "",
        error: error instanceof Error ? error.message : String(error)
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    ok: false,
    status: 0,
    headers: {},
    bodyText: "",
    error: "تعذر إكمال الجلب الآمن."
  };
}

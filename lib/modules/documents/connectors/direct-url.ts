import { createWriteStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { pipeline } from "node:stream/promises";
import { Readable, Transform } from "node:stream";
import {
  assertUrlSafeForFetch,
  toSafeDisplayUrl,
  type DnsResolver
} from "@/lib/modules/documents/url-security";
import {
  directUrlMaxBytes,
  directUrlMaxRedirects,
  directUrlTimeoutMs,
  urlInspectMaxBytes,
  urlInspectTimeoutMs
} from "@/lib/modules/documents/feature-flags";
import { resolveDownloadFileName } from "@/lib/modules/documents/filename";
import { sniffAllowedMime } from "@/lib/modules/documents/mime-sniff";
import type { DocumentSourceConnector, DownloadedDirectFile, InspectedDirectFile } from "./types";

export type FetchLike = typeof fetch;

export class DirectUrlError extends Error {
  constructor(
    public readonly code:
      | "URL_REJECTED"
      | "URL_BLOCKED"
      | "DNS_RESOLUTION_FAILED"
      | "REMOTE_TIMEOUT"
      | "TIMEOUT"
      | "TOO_MANY_REDIRECTS"
      | "FILE_TOO_LARGE"
      | "UNSUPPORTED_MIME"
      | "CONTENT_TYPE_MISMATCH"
      | "REMOTE_CONTENT_NOT_A_FILE"
      | "MIME_NOT_ALLOWED"
      | "MIME_MISMATCH_HTML"
      | "DOWNLOAD_FAILED"
      | "DOWNLOAD_INTERRUPTED"
      | "STORAGE_UPLOAD_FAILED"
      | "EMPTY_BODY",
    message: string,
    public readonly securityReason?: string
  ) {
    super(message);
    this.name = "DirectUrlError";
  }
}

export type DirectUrlDeps = {
  fetchImpl?: FetchLike;
  resolver?: DnsResolver;
  maxBytes?: number;
  timeoutMs?: number;
  maxRedirects?: number;
  inspectMaxBytes?: number;
};

async function validateUrl(url: string, resolver?: DnsResolver) {
  const result = await assertUrlSafeForFetch(url, { resolver });
  if (!result.allowed || !result.normalizedUrl) {
    const code =
      result.reasonCode === "DNS_RESOLUTION_FAILED"
        ? "DNS_RESOLUTION_FAILED"
        : "URL_REJECTED";
    throw new DirectUrlError(code, "الرابط مرفوض أمنيًا.", result.reasonCode);
  }
  return result;
}

function redirectLocation(base: string, location: string | null): string | null {
  if (!location) return null;
  try {
    return new URL(location, base).toString();
  } catch {
    return null;
  }
}

async function followHeadOrGet(opts: {
  url: string;
  method: "HEAD" | "GET";
  deps: DirectUrlDeps;
  range?: string;
}): Promise<{ response: Response; finalUrl: string; redirects: number }> {
  const fetchImpl = opts.deps.fetchImpl ?? fetch;
  const maxRedirects = opts.deps.maxRedirects ?? directUrlMaxRedirects();
  const timeoutMs = opts.deps.timeoutMs ?? directUrlTimeoutMs();
  let current = opts.url;
  let redirects = 0;

  for (;;) {
    await validateUrl(current, opts.deps.resolver);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      const headers: Record<string, string> = {
        Accept:
          "application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,image/png,image/jpeg,*/*",
        "User-Agent": "HakeemDocumentImport/1.0"
      };
      if (opts.range) headers.Range = opts.range;
      response = await fetchImpl(current, {
        method: opts.method,
        redirect: "manual",
        signal: controller.signal,
        headers
      });
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof DirectUrlError) throw err;
      if ((err as Error)?.name === "AbortError") {
        throw new DirectUrlError("REMOTE_TIMEOUT", "انتهت مهلة الاتصال بالرابط.");
      }
      throw new DirectUrlError("DOWNLOAD_FAILED", "تعذّر الاتصال بالرابط.");
    } finally {
      clearTimeout(timer);
    }

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const next = redirectLocation(current, response.headers.get("location"));
      try {
        await response.body?.cancel();
      } catch {
        /* ignore */
      }
      if (!next) throw new DirectUrlError("DOWNLOAD_FAILED", "إعادة توجيه بلا موقع صالح.");
      redirects += 1;
      if (redirects > maxRedirects) {
        throw new DirectUrlError("TOO_MANY_REDIRECTS", "تجاوز الحد الأقصى لإعادة التوجيه.");
      }
      if (new URL(next).protocol !== "https:") {
        throw new DirectUrlError("URL_REJECTED", "إعادة التوجيه إلى بروتوكول غير HTTPS مرفوضة.", "HTTPS_REQUIRED");
      }
      current = next;
      continue;
    }

    return { response, finalUrl: current, redirects };
  }
}

/** يقرأ حتى maxBytes من جسم الاستجابة ثم يلغي الباقي — لـ inspect فقط. */
async function drainBodyLimited(body: ReadableStream<Uint8Array> | null, maxBytes: number): Promise<void> {
  if (!body) return;
  const reader = body.getReader();
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value?.byteLength ?? 0;
      if (total > maxBytes) {
        await reader.cancel();
        break;
      }
    }
  } catch {
    try {
      await reader.cancel();
    } catch {
      /* ignore */
    }
  }
}

/** فحص الرابط بدون تنزيل كامل — HEAD ثم GET محدود عند الحاجة. */
export async function inspectDirectUrl(url: string, deps: DirectUrlDeps = {}): Promise<InspectedDirectFile> {
  const inspectTimeout = deps.timeoutMs ?? urlInspectTimeoutMs();
  const inspectCap = deps.inspectMaxBytes ?? urlInspectMaxBytes();
  const inspectDeps: DirectUrlDeps = { ...deps, timeoutMs: inspectTimeout };
  const initial = await validateUrl(url, deps.resolver);
  let hop;
  try {
    hop = await followHeadOrGet({ url: initial.normalizedUrl!, method: "HEAD", deps: inspectDeps });
  } catch (err) {
    if (err instanceof DirectUrlError && err.code === "DOWNLOAD_FAILED") {
      hop = await followHeadOrGet({
        url: initial.normalizedUrl!,
        method: "GET",
        deps: inspectDeps,
        range: `bytes=0-${Math.max(0, inspectCap - 1)}`
      });
    } else {
      throw err;
    }
  }

  const { response, finalUrl, redirects } = hop;
  const status = response.status;
  const requiresAuthentication = status === 401 || status === 403;
  const accessible = status >= 200 && status < 400 && !requiresAuthentication;
  const reportedMimeType = response.headers.get("content-type")?.split(";")[0]?.trim() || undefined;
  const len = response.headers.get("content-length");
  const reportedSize = len && /^\d+$/.test(len) ? Number(len) : undefined;
  const warnings: string[] = [];
  const fileName = resolveDownloadFileName({
    contentDisposition: response.headers.get("content-disposition"),
    url: finalUrl,
    mimeType: reportedMimeType || "application/octet-stream"
  });

  // لا تُحمَّل الاستجابة كاملة — أقصى inspectCap ثم إلغاء
  await drainBodyLimited(response.body, inspectCap);

  if (reportedSize && reportedSize > (deps.maxBytes ?? directUrlMaxBytes())) {
    warnings.push("FILE_SIZE_EXCEEDS_LIMIT");
  }

  return {
    provider: "DIRECT_URL",
    normalizedUrl: toSafeDisplayUrl(finalUrl),
    safeDisplayUrl: toSafeDisplayUrl(finalUrl),
    fileName,
    reportedMimeType,
    reportedSize,
    finalHost: new URL(finalUrl).host,
    redirects,
    warnings,
    requiresAuthentication,
    accessible
  };
}

/** تنزيل متدفق إلى ملف مؤقت مع SHA-256 وحد حجم — بدون arrayBuffer كامل. */
export async function downloadDirectUrlStreaming(url: string, deps: DirectUrlDeps = {}): Promise<DownloadedDirectFile> {
  const maxBytes = deps.maxBytes ?? directUrlMaxBytes();
  const initial = await validateUrl(url, deps.resolver);
  const { response, finalUrl } = await followHeadOrGet({
    url: initial.normalizedUrl!,
    method: "GET",
    deps
  });

  if (!response.ok || !response.body) {
    try {
      await response.body?.cancel();
    } catch {
      /* ignore */
    }
    throw new DirectUrlError("DOWNLOAD_FAILED", `فشل التنزيل (${response.status}).`);
  }

  const contentLength = response.headers.get("content-length");
  if (contentLength && /^\d+$/.test(contentLength) && Number(contentLength) > maxBytes) {
    try {
      await response.body.cancel();
    } catch {
      /* ignore */
    }
    throw new DirectUrlError("FILE_TOO_LARGE", "حجم الملف يتجاوز الحد المسموح.");
  }

  const reportedMimeType = response.headers.get("content-type")?.split(";")[0]?.trim() || undefined;
  const contentDisposition = response.headers.get("content-disposition");
  const dir = await mkdtemp(path.join(tmpdir(), "hakeem-url-"));
  const temporaryPath = path.join(dir, "payload.bin");
  const hash = createHash("sha256");
  let size = 0;
  const headChunks: Buffer[] = [];
  let headSize = 0;

  const nodeReadable = Readable.fromWeb(response.body as import("stream/web").ReadableStream);
  const counter = new Transform({
    transform(chunk, _enc, cb) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += buf.length;
      if (size > maxBytes) {
        cb(new DirectUrlError("FILE_TOO_LARGE", "حجم الملف يتجاوز الحد المسموح أثناء التنزيل."));
        return;
      }
      hash.update(buf);
      if (headSize < 4100) {
        const need = 4100 - headSize;
        headChunks.push(buf.subarray(0, need));
        headSize += Math.min(buf.length, need);
      }
      cb(null, buf);
    }
  });

  try {
    await pipeline(nodeReadable, counter, createWriteStream(temporaryPath));
  } catch (err) {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
    if (err instanceof DirectUrlError) throw err;
    throw new DirectUrlError("DOWNLOAD_INTERRUPTED", "انقطع التنزيل.");
  }

  if (size === 0) {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
    throw new DirectUrlError("EMPTY_BODY", "الملف فارغ.");
  }

  const sniff = await sniffAllowedMime(Buffer.concat(headChunks), reportedMimeType);
  if (!sniff.ok) {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
    const code =
      sniff.reasonCode === "REMOTE_CONTENT_NOT_A_FILE"
        ? "REMOTE_CONTENT_NOT_A_FILE"
        : sniff.reasonCode === "MIME_MISMATCH_HTML"
          ? "CONTENT_TYPE_MISMATCH"
          : "UNSUPPORTED_MIME";
    throw new DirectUrlError(code, "نوع الملف غير مقبول بعد الفحص.");
  }

  const fileName = resolveDownloadFileName({
    contentDisposition,
    url: finalUrl,
    mimeType: sniff.detectedMimeType
  });

  return {
    temporaryPath,
    sha256: hash.digest("hex"),
    size,
    reportedMimeType,
    detectedMimeType: sniff.detectedMimeType,
    fileName
  };
}

export function createDirectUrlConnector(deps: DirectUrlDeps = {}): DocumentSourceConnector {
  return {
    provider: "DIRECT_URL",
    canHandle(input) {
      if (!input.url) return false;
      try {
        return new URL(input.url).protocol === "https:";
      } catch {
        return false;
      }
    },
    inspect(input) {
      return inspectDirectUrl(input.url, deps);
    },
    download(input) {
      return downloadDirectUrlStreaming(input.url, deps);
    }
  };
}

export async function cleanupDownloadedFile(file: { temporaryPath: string }) {
  const dir = path.dirname(file.temporaryPath);
  await rm(dir, { recursive: true, force: true }).catch(() => undefined);
}

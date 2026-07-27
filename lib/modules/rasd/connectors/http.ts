import { readFile } from "fs/promises";
import { fileURLToPath } from "url";
import { RASD_FIXTURES_ONLY, RASD_USER_AGENT, envBool } from "../flags";
import type { FetchResult } from "../types";

export interface RasdFetchOptions {
  method?: "GET" | "HEAD";
  headers?: Record<string, string>;
  timeoutMs?: number;
  fixturePath?: string;
  includeBuffer?: boolean;
}

function headersToRecord(headers: Headers): Record<string, string> {
  const record: Record<string, string> = {};
  headers.forEach((value, key) => {
    record[key.toLowerCase()] = value;
  });
  return record;
}

function filePathFromUrl(url: string): string {
  if (url.startsWith("file://")) return fileURLToPath(url);
  return url;
}

async function fetchFixture(pathOrUrl: string): Promise<FetchResult> {
  try {
    const buffer = await readFile(filePathFromUrl(pathOrUrl));
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

export async function rasdFetch(url: string, opts: RasdFetchOptions = {}): Promise<FetchResult> {
  if (opts.fixturePath || url.startsWith("file://")) {
    return fetchFixture(opts.fixturePath ?? url);
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

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 20_000);

  try {
    const response = await fetch(url, {
      method: opts.method ?? "GET",
      headers: {
        "User-Agent": RASD_USER_AGENT,
        Accept: "text/html,application/xhtml+xml,application/xml,application/pdf,text/plain;q=0.9,*/*;q=0.8",
        ...(opts.headers ?? {})
      },
      signal: controller.signal,
      redirect: "follow"
    });
    const headers = headersToRecord(response.headers);
    const contentType = headers["content-type"] ?? "";
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
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

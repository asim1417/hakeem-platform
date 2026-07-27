import { readdir } from "fs/promises";
import path from "path";
import { RASD_FIXTURES_ONLY, RASD_RATE_LIMIT_PER_MINUTE, envBool } from "../flags";
import type { ConnectorDiscoverOptions, ConnectorDiscoverResult, ConnectorFetchOptions, DiscoveredDocument, FetchResult } from "../types";
import type { RasdConnector } from "./base";
import { rasdFetch } from "./http";
import { RateLimiter } from "./rate-limit";

const NCAR_BASE = "https://ncar.gov.sa";
const DEFAULT_INDEX = `${NCAR_BASE}/`;
const FIXTURE_DIR = path.join(process.cwd(), "data/rasd/fixtures/ncar");

function stripTags(value: string): string {
  return value.replace(/<script[\s\S]*?<\/script>/giu, " ").replace(/<style[\s\S]*?<\/style>/giu, " ").replace(/<[^>]+>/g, " ");
}

function decode(value: string): string {
  return value.replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

function absoluteUrl(href: string): string {
  if (/^https?:\/\//i.test(href)) return href;
  return new URL(href, NCAR_BASE).toString();
}

function parseIndex(html: string, limit: number): DiscoveredDocument[] {
  const documents = new Map<string, DiscoveredDocument>();
  for (const match of html.matchAll(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/giu)) {
    const href = match[1] ?? "";
    if (!/(Legislation|laws?|regulation|Details)/i.test(href)) continue;
    const title = decode(stripTags(match[2] ?? ""));
    if (title && !/(نظام|لائحة|تنظيم|قواعد|قرار)/u.test(title)) continue;
    const url = absoluteUrl(href);
    documents.set(url, {
      sourceCode: "NCAR",
      url,
      title: title || undefined,
      sourceDocumentId: url.split("/").filter(Boolean).pop()
    });
    if (documents.size >= limit) break;
  }
  return [...documents.values()];
}

async function discoverFixtures(limit: number): Promise<ConnectorDiscoverResult> {
  try {
    const entries = await readdir(FIXTURE_DIR);
    const documents = entries
      .filter((entry) => /\.(html?|txt|json)$/i.test(entry))
      .slice(0, limit)
      .map((entry): DiscoveredDocument => ({
        sourceCode: "NCAR",
        url: `file://${path.join(FIXTURE_DIR, entry)}`,
        title: entry.replace(/\.[^.]+$/, ""),
        sourceDocumentId: entry
      }));
    return { sourceCode: "NCAR", ok: true, documents, pagesVisited: 1, metadata: { fixtureDir: FIXTURE_DIR } };
  } catch (error) {
    return {
      sourceCode: "NCAR",
      ok: false,
      documents: [],
      pagesVisited: 0,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

export class NcarConnector implements RasdConnector {
  readonly code = "NCAR" as const;
  private readonly limiter = new RateLimiter(RASD_RATE_LIMIT_PER_MINUTE);

  async discover(opts: ConnectorDiscoverOptions = {}): Promise<ConnectorDiscoverResult> {
    const limit = opts.limit ?? 100;
    if (envBool("RASD_FIXTURES_ONLY", RASD_FIXTURES_ONLY) || opts.fixturePath) {
      if (!opts.fixturePath) return discoverFixtures(limit);
      const fixture = await rasdFetch(`file://${opts.fixturePath}`);
      return {
        sourceCode: this.code,
        ok: fixture.ok,
        documents: fixture.ok ? parseIndex(fixture.bodyText, limit) : [],
        pagesVisited: fixture.ok ? 1 : 0,
        error: fixture.error,
        metadata: { fixturePath: opts.fixturePath }
      };
    }

    await this.limiter.removeToken();
    const result = await rasdFetch(opts.indexUrl ?? DEFAULT_INDEX, { timeoutMs: 20_000 });
    if (!result.ok) {
      return {
        sourceCode: this.code,
        ok: false,
        documents: [],
        pagesVisited: 0,
        error: result.error ?? `NCAR unreachable (${result.status})`
      };
    }

    return { sourceCode: this.code, ok: true, documents: parseIndex(result.bodyText, limit), pagesVisited: 1 };
  }

  async fetchDocument(url: string, opts: ConnectorFetchOptions = {}): Promise<FetchResult> {
    await this.limiter.removeToken();
    return rasdFetch(url, { timeoutMs: opts.timeoutMs, fixturePath: opts.fixturePath, headers: opts.headers, includeBuffer: true });
  }

  async healthCheck(): Promise<{ ok: boolean; status?: number; error?: string }> {
    const result = await rasdFetch(DEFAULT_INDEX, { method: "HEAD", timeoutMs: 8_000 });
    return { ok: result.ok, status: result.status, error: result.error };
  }
}

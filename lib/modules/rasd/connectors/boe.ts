import { readdir } from "fs/promises";
import path from "path";
import { RASD_FIXTURES_ONLY, RASD_RATE_LIMIT_PER_MINUTE, envBool } from "../flags";
import type { ConnectorDiscoverOptions, ConnectorDiscoverResult, ConnectorFetchOptions, DiscoveredDocument, FetchResult } from "../types";
import type { RasdConnector } from "./base";
import { rasdFetch } from "./http";
import { RateLimiter } from "./rate-limit";

const BOE_BASE = "https://laws.boe.gov.sa";
const LAWS_HOME = `${BOE_BASE}/BoeLaws/Laws/LawsHome`;
const LAW_DETAILS = `${BOE_BASE}/BoeLaws/Laws/LawDetails`;
const FIXTURE_DIR = path.join(process.cwd(), "data/rasd/fixtures/boe");

function stripTags(value: string): string {
  return value.replace(/<script[\s\S]*?<\/script>/giu, " ").replace(/<style[\s\S]*?<\/style>/giu, " ").replace(/<[^>]+>/g, " ");
}

function decode(value: string): string {
  return value.replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

function absoluteUrl(href: string): string {
  if (/^https?:\/\//i.test(href)) return href;
  return new URL(href, BOE_BASE).toString();
}

function parseLawsHome(html: string, limit: number): DiscoveredDocument[] {
  const documents = new Map<string, DiscoveredDocument>();
  for (const match of html.matchAll(/<a\s+[^>]*href=["']([^"']*LawDetails[^"']*)["'][^>]*>([\s\S]*?)<\/a>/giu)) {
    const href = match[1] ?? "";
    const title = decode(stripTags(match[2] ?? ""));
    const url = absoluteUrl(href);
    documents.set(url, {
      sourceCode: "BOE",
      url,
      title: title || undefined,
      sourceDocumentId: new URL(url).searchParams.get("lawId") ?? undefined
    });
    if (documents.size >= limit) break;
  }
  return [...documents.values()];
}

async function discoverFixtures(limit: number): Promise<ConnectorDiscoverResult> {
  try {
    const entries = await readdir(FIXTURE_DIR);
    const documents = entries
      .filter((entry) => /\.(html?|txt)$/i.test(entry))
      .slice(0, limit)
      .map((entry): DiscoveredDocument => ({
        sourceCode: "BOE",
        url: `file://${path.join(FIXTURE_DIR, entry)}`,
        title: entry.replace(/\.[^.]+$/, ""),
        sourceDocumentId: entry
      }));
    return { sourceCode: "BOE", ok: true, documents, pagesVisited: 1, metadata: { fixtureDir: FIXTURE_DIR } };
  } catch (error) {
    return {
      sourceCode: "BOE",
      ok: false,
      documents: [],
      pagesVisited: 0,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

export class BoeConnector implements RasdConnector {
  readonly code = "BOE" as const;
  private readonly limiter = new RateLimiter(RASD_RATE_LIMIT_PER_MINUTE);

  async discover(opts: ConnectorDiscoverOptions = {}): Promise<ConnectorDiscoverResult> {
    const limit = opts.limit ?? 100;
    if (envBool("RASD_FIXTURES_ONLY", RASD_FIXTURES_ONLY) || opts.fixturePath) {
      if (!opts.fixturePath) return discoverFixtures(limit);
      const fixture = await rasdFetch(`file://${opts.fixturePath}`);
      return {
        sourceCode: this.code,
        ok: fixture.ok,
        documents: fixture.ok ? parseLawsHome(fixture.bodyText, limit) : [],
        pagesVisited: fixture.ok ? 1 : 0,
        error: fixture.error,
        metadata: { fixturePath: opts.fixturePath }
      };
    }

    await this.limiter.removeToken();
    const result = await rasdFetch(opts.indexUrl ?? LAWS_HOME, { timeoutMs: 20_000 });
    if (!result.ok) {
      return {
        sourceCode: this.code,
        ok: false,
        documents: [],
        pagesVisited: 0,
        error: result.error ?? `BOE unreachable (${result.status})`,
        metadata: { lawDetailsPath: LAW_DETAILS }
      };
    }

    return {
      sourceCode: this.code,
      ok: true,
      documents: parseLawsHome(result.bodyText, limit),
      pagesVisited: 1,
      metadata: { lawDetailsPath: LAW_DETAILS }
    };
  }

  async fetchDocument(url: string, opts: ConnectorFetchOptions = {}): Promise<FetchResult> {
    await this.limiter.removeToken();
    return rasdFetch(url, { timeoutMs: opts.timeoutMs, fixturePath: opts.fixturePath, headers: opts.headers, includeBuffer: true });
  }

  async healthCheck(): Promise<{ ok: boolean; status?: number; error?: string }> {
    const result = await rasdFetch(LAWS_HOME, { method: "HEAD", timeoutMs: 8_000 });
    return { ok: result.ok, status: result.status, error: result.error };
  }
}

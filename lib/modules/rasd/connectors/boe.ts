import { readdir } from "fs/promises";
import path from "path";
import { RASD_FIXTURES_ONLY, RASD_RATE_LIMIT_PER_MINUTE, envBool } from "../flags";
import type { ConnectorDiscoverOptions, ConnectorDiscoverResult, ConnectorFetchOptions, DiscoveredDocument, FetchResult } from "../types";
import {
  defaultNormalizeDocument,
  defaultParseSnapshot,
  type LegislativeSourceConnector,
  type NormalizedLegalDocument,
  type ParsedLegalDocument,
  type RawSourceSnapshot
} from "./base";
import { rasdFetch } from "./http";
import { RateLimiter } from "./rate-limit";
import { getConnectorStatus } from "./status";

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

export class BoeConnector implements LegislativeSourceConnector {
  readonly code = "BOE" as const;
  readonly displayName = getConnectorStatus("BOE").displayNameAr;
  private readonly limiter = new RateLimiter(RASD_RATE_LIMIT_PER_MINUTE);

  async discover(opts: ConnectorDiscoverOptions = {}): Promise<ConnectorDiscoverResult> {
    const limit = opts.limit ?? 100;
    const fixturesOnly = Boolean(opts.fixturesOnly) || envBool("RASD_FIXTURES_ONLY", RASD_FIXTURES_ONLY);
    if (fixturesOnly || opts.fixturePath) {
      if (opts.fixturePath && !fixturesOnly) {
        const fixture = await rasdFetch(`file://${opts.fixturePath}`, { allowFixtureFileUrl: true });
        return {
          sourceCode: this.code,
          ok: fixture.ok,
          documents: fixture.ok ? parseLawsHome(fixture.bodyText, limit) : [],
          pagesVisited: fixture.ok ? 1 : 0,
          error: fixture.error,
          metadata: { fixturePath: opts.fixturePath }
        };
      }
      return discoverFixtures(limit);
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
    return rasdFetch(url, {
      timeoutMs: opts.timeoutMs,
      fixturePath: opts.fixturePath,
      headers: opts.headers,
      includeBuffer: true,
      allowFixtureFileUrl: Boolean(opts.fixturePath || url.startsWith("file://"))
    });
  }

  async healthCheck(): Promise<{ ok: boolean; status?: number; error?: string; outcome?: "SUCCEEDED" | "FAILED" | "UNREACHABLE" | "DEGRADED" | "SKIPPED" }> {
    const result = await rasdFetch(LAWS_HOME, { method: "HEAD", timeoutMs: 8_000 });
    const outcome = result.ok
      ? ("SUCCEEDED" as const)
      : /econnreset|tls|handshake/i.test(result.error ?? "")
        ? ("UNREACHABLE" as const)
        : ("FAILED" as const);
    return { ok: result.ok, status: result.status, error: result.error, outcome };
  }

  async parse(snapshot: RawSourceSnapshot): Promise<ParsedLegalDocument> {
    return defaultParseSnapshot(snapshot);
  }

  async normalize(document: ParsedLegalDocument): Promise<NormalizedLegalDocument> {
    return defaultNormalizeDocument(document);
  }
}

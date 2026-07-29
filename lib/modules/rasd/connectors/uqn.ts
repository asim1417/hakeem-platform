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
import { withRetry } from "./retry";
import { getConnectorStatus } from "./status";

const UQN_BASE = "https://www.uqn.gov.sa";
const DEFAULT_SITEMAP = `${UQN_BASE}/sitemap_0.xml`;
const DEFAULT_INDEX = `${UQN_BASE}/Decisions`;
const FIXTURE_DIR = path.join(process.cwd(), "data/rasd/fixtures/uqn");

function stripTags(html: string): string {
  return html.replace(/<script[\s\S]*?<\/script>/giu, " ").replace(/<style[\s\S]*?<\/style>/giu, " ").replace(/<[^>]+>/g, " ");
}

function decode(value: string): string {
  return value.replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

function absoluteUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return new URL(url, UQN_BASE).toString();
}

function isLegislativeUqnUrl(url: string): boolean {
  return /\/(decisions-and-regulations|decisions\/|royal-decrees|rules-and-regulations|council-of-ministers|ministerial-decisions|royal-orders)\b/i.test(
    url
  );
}

function isNestedSitemapUrl(url: string): boolean {
  return /\/sitemaps?\//i.test(url) || /sitemap[^/]*\.xml/i.test(url);
}

function parseSitemap(xml: string, limit: number): DiscoveredDocument[] {
  const urls = [...xml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/giu)]
    .map((match) => decode(match[1] ?? ""))
    .filter(
      (url) =>
        /uqn\.gov\.sa/i.test(url) &&
        !/\/ajax\//i.test(url) &&
        !/[?&]page=/i.test(url) &&
        !isNestedSitemapUrl(url)
    );

  const legislative = urls.filter(isLegislativeUqnUrl);
  // Prefer legislative detail pages; do not fall back to sitemap/news noise as "documents".
  const chosen = legislative.slice(0, limit);

  return chosen.map((url) => ({
    sourceCode: "UQN",
    url,
    sourceDocumentId: url.split("/").filter(Boolean).pop()
  }));
}

function parseIndexHtml(html: string, limit: number): DiscoveredDocument[] {
  const documents = new Map<string, DiscoveredDocument>();
  for (const match of html.matchAll(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/giu)) {
    const href = match[1] ?? "";
    if (!href || /\/ajax\//i.test(href) || /[?&]page=/i.test(href)) continue;
    const title = decode(stripTags(match[2] ?? ""));
    if (!title || !/(نظام|لائحة|قرار|مرسوم|تنظيم|قواعد)/u.test(title)) continue;
    const url = absoluteUrl(href);
    documents.set(url, {
      sourceCode: "UQN",
      url,
      title,
      sourceDocumentId: url.split("/").filter(Boolean).pop()
    });
    if (documents.size >= limit) break;
  }
  return [...documents.values()];
}

async function discoverFixtures(limit: number): Promise<ConnectorDiscoverResult> {
  try {
    const entries = await readdir(FIXTURE_DIR);
    const preferred = entries.filter((entry) => /^decision-.*\.html?$/i.test(entry));
    const htmlFiles = preferred.length > 0 ? preferred : entries.filter((entry) => /\.html?$/i.test(entry) && !/index/i.test(entry));
    const documents: DiscoveredDocument[] = htmlFiles.slice(0, limit).map((entry) => ({
      sourceCode: "UQN" as const,
      url: `file://${path.join(FIXTURE_DIR, entry)}`,
      title: entry.replace(/\.[^.]+$/, ""),
      sourceDocumentId: entry.replace(/\.[^.]+$/, "")
    }));
    return { sourceCode: "UQN", ok: true, documents, pagesVisited: 1, metadata: { fixtureDir: FIXTURE_DIR } };
  } catch (error) {
    return {
      sourceCode: "UQN",
      ok: false,
      documents: [],
      pagesVisited: 0,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

export class UqnConnector implements LegislativeSourceConnector {
  readonly code = "UQN" as const;
  readonly displayName = getConnectorStatus("UQN").displayNameAr;
  private readonly limiter = new RateLimiter(RASD_RATE_LIMIT_PER_MINUTE);

  async discover(opts: ConnectorDiscoverOptions = {}): Promise<ConnectorDiscoverResult> {
    const limit = opts.limit ?? 100;
    const fixturesOnly = Boolean(opts.fixturesOnly) || envBool("RASD_FIXTURES_ONLY", RASD_FIXTURES_ONLY);

    if (opts.fixturePath && !fixturesOnly) {
      const fixture = await rasdFetch(`file://${opts.fixturePath}`, { allowFixtureFileUrl: true });
      const documents = fixture.ok ? (opts.fixturePath.endsWith(".xml") ? parseSitemap(fixture.bodyText, limit) : parseIndexHtml(fixture.bodyText, limit)) : [];
      return {
        sourceCode: this.code,
        ok: fixture.ok,
        documents,
        pagesVisited: fixture.ok ? 1 : 0,
        error: fixture.error,
        metadata: { fixturePath: opts.fixturePath }
      };
    }

    if (fixturesOnly || opts.fixturePath) return discoverFixtures(limit);

    await this.limiter.removeToken();
    const sitemap = await withRetry(() => rasdFetch(opts.sitemapUrl ?? DEFAULT_SITEMAP, { timeoutMs: 15_000 }), {
      retries: 2,
      baseMs: 500,
      label: "UQN sitemap"
    });
    if (sitemap.ok && sitemap.bodyText) {
      const documents = parseSitemap(sitemap.bodyText, limit);
      if (documents.length > 0) return { sourceCode: this.code, ok: true, documents, pagesVisited: 1 };
    }

    await this.limiter.removeToken();
    const index = await rasdFetch(opts.indexUrl ?? DEFAULT_INDEX, { timeoutMs: 15_000 });
    if (!index.ok) {
      return {
        sourceCode: this.code,
        ok: false,
        documents: [],
        pagesVisited: sitemap.ok ? 1 : 0,
        error: index.error ?? `HTTP ${index.status}`
      };
    }
    return { sourceCode: this.code, ok: true, documents: parseIndexHtml(index.bodyText, limit), pagesVisited: 2 };
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
    const result = await rasdFetch(DEFAULT_SITEMAP, { method: "HEAD", timeoutMs: 8_000 });
    return {
      ok: result.ok,
      status: result.status,
      error: result.error,
      outcome: result.ok ? "SUCCEEDED" : "FAILED"
    };
  }

  async parse(snapshot: RawSourceSnapshot): Promise<ParsedLegalDocument> {
    return defaultParseSnapshot(snapshot);
  }

  async normalize(document: ParsedLegalDocument): Promise<NormalizedLegalDocument> {
    return defaultNormalizeDocument(document);
  }
}

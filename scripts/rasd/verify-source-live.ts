/**
 * Live verification probe for official legislative sources (BOE / NCAR / UQN).
 * Does NOT claim LIVE_VERIFIED unless 10 live documents succeed.
 * Fixtures are never counted as live evidence.
 */
import { writeFileSync, mkdirSync } from "fs";
import path from "path";
import { lookup } from "dns/promises";
import { connect } from "net";
import tls from "tls";
import { getConnector } from "@/lib/modules/rasd/connectors";
import { parseDocumentStructure } from "@/lib/modules/rasd/parse/structure";
import { contentFingerprint } from "@/lib/modules/rasd/hash";
import { saveSnapshotLocal } from "@/lib/modules/rasd/snapshot/store";
import type { RasdSourceCode } from "@/lib/modules/rasd/types";

const TARGET = (process.env.RASD_LIVE_TARGET || "BOE").toUpperCase() as RasdSourceCode;
const LIMIT = Number(process.env.RASD_LIVE_LIMIT || 10);
const HOSTS: Record<RasdSourceCode, string[]> = {
  BOE: ["laws.boe.gov.sa", "boe.gov.sa"],
  NCAR: ["ncar.gov.sa", "www.ncar.gov.sa"],
  UQN: ["www.uqn.gov.sa", "uqn.gov.sa"]
};

interface LayerResult {
  ok: boolean;
  detail?: Record<string, unknown>;
  error?: string;
}

async function dnsLayer(host: string): Promise<LayerResult> {
  try {
    const records = await lookup(host, { all: true });
    return { ok: records.length > 0, detail: { addrs: records.map((r) => r.address) } };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function tcpLayer(host: string, port = 443, timeoutMs = 8000): Promise<LayerResult> {
  return new Promise((resolve) => {
    const started = Date.now();
    const socket = connect({ host, port });
    const timer = setTimeout(() => {
      socket.destroy();
      resolve({ ok: false, error: "tcp_timeout" });
    }, timeoutMs);
    socket.once("connect", () => {
      clearTimeout(timer);
      const ms = Date.now() - started;
      socket.end();
      resolve({ ok: true, detail: { ms } });
    });
    socket.once("error", (error) => {
      clearTimeout(timer);
      resolve({ ok: false, error: error.message });
    });
  });
}

function tlsLayer(host: string, timeoutMs = 12000): Promise<LayerResult> {
  return new Promise((resolve) => {
    const started = Date.now();
    const socket = tls.connect({
      host,
      port: 443,
      servername: host,
      rejectUnauthorized: true,
      timeout: timeoutMs
    });
    const timer = setTimeout(() => {
      socket.destroy();
      resolve({ ok: false, error: "tls_timeout" });
    }, timeoutMs);
    socket.once("secureConnect", () => {
      clearTimeout(timer);
      const detail = {
        ms: Date.now() - started,
        protocol: socket.getProtocol(),
        authorized: socket.authorized,
        cipher: socket.getCipher()
      };
      socket.end();
      resolve({ ok: true, detail });
    });
    socket.once("error", (error) => {
      clearTimeout(timer);
      resolve({ ok: false, error: error.message });
    });
  });
}

async function httpLayer(url: string): Promise<LayerResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "manual",
      signal: controller.signal,
      headers: { "user-agent": "Hakeem-Rasd/1.0 (+https://hakeem.sa)", accept: "text/html,application/xhtml+xml,*/*" }
    });
    clearTimeout(timer);
    return {
      ok: response.status >= 200 && response.status < 400,
      detail: {
        status: response.status,
        contentType: response.headers.get("content-type"),
        location: response.headers.get("location"),
        redirected: false
      }
    };
  } catch (error) {
    clearTimeout(timer);
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function main(): Promise<void> {
  process.env.RASD_ENABLED = process.env.RASD_ENABLED || "true";
  process.env.RASD_AUTO_FETCH_ENABLED = "true";
  process.env.RASD_FIXTURES_ONLY = "false";
  process.env.RASD_MEMORY_ONLY = process.env.RASD_MEMORY_ONLY || "true";
  process.env[`RASD_SOURCE_${TARGET}_ENABLED`] = "true";

  const hosts = HOSTS[TARGET] ?? [];
  const connectivity = [];
  for (const host of hosts) {
    const dns = await dnsLayer(host);
    const tcp = dns.ok ? await tcpLayer(host) : { ok: false, error: "skipped_dns" };
    const tlsResult = tcp.ok ? await tlsLayer(host) : { ok: false, error: "skipped_tcp" };
    const http = tlsResult.ok ? await httpLayer(`https://${host}/`) : { ok: false, error: "skipped_tls" };
    connectivity.push({ host, dns, tcp, tls: tlsResult, http });
  }

  const tlsOk = connectivity.some((c) => c.tls.ok);
  const httpOk = connectivity.some((c) => c.http.ok);

  const connector = getConnector(TARGET);
  const health = await connector.healthCheck().catch((error) => ({
    ok: false,
    error: error instanceof Error ? error.message : String(error)
  }));

  let discoverError: string | undefined;
  let documents: Array<{ url: string; title?: string; sourceDocumentId?: string }> = [];
  try {
    const discovered = await connector.discover({ limit: LIMIT, fixturesOnly: false });
    discoverError = discovered.ok ? undefined : discovered.error;
    documents = discovered.documents.slice(0, LIMIT);
  } catch (error) {
    discoverError = error instanceof Error ? error.message : String(error);
  }

  const liveDocs = [];
  for (const doc of documents) {
    try {
      const fetched = await connector.fetchDocument(doc.url, { timeoutMs: 20000 });
      if (!fetched.ok) {
        liveDocs.push({
          url: doc.url,
          title: doc.title,
          ok: false,
          error: fetched.error ?? `HTTP ${fetched.status}`
        });
        continue;
      }
      const body = fetched.bodyText || "";
      const parsed = parseDocumentStructure(body, TARGET);
      const snapshot = await saveSnapshotLocal({
        runId: `live_${TARGET.toLowerCase()}_${Date.now().toString(36)}`,
        sourceCode: TARGET,
        url: doc.url,
        body,
        contentType: fetched.headers["content-type"]
      });
      liveDocs.push({
        url: doc.url,
        title: parsed.title ?? doc.title ?? null,
        type: parsed.metadata.documentType ?? null,
        instrumentType: parsed.metadata.instrumentType ?? null,
        instrumentNumber: parsed.metadata.normalizedInstrumentNumber ?? parsed.metadata.instrumentNumber ?? null,
        date:
          parsed.metadata.instrumentDateGregorian ??
          parsed.metadata.instrumentDateHijri ??
          parsed.metadata.instrumentDate ??
          null,
        uqnIssue: parsed.metadata.uqnIssue ?? null,
        rawHash: contentFingerprint(body),
        normalizedHash: parsed.normalizedHash,
        parserConfidence: parsed.confidence,
        warnings: [] as string[],
        snapshotPath: snapshot.path,
        contentHash: snapshot.contentHash,
        ok: true,
        httpStatus: fetched.status,
        contentType: fetched.headers["content-type"] ?? null
      });
    } catch (error) {
      liveDocs.push({
        url: doc.url,
        title: doc.title,
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  const successCount = liveDocs.filter((d) => d.ok).length;
  let certification: "LIVE_VERIFIED" | "DEGRADED" | "NOT_LIVE_VERIFIED" = "NOT_LIVE_VERIFIED";
  if (successCount >= 10 && tlsOk && httpOk) certification = "LIVE_VERIFIED";
  else if (tlsOk || httpOk || successCount > 0) certification = "DEGRADED";
  else certification = "DEGRADED"; // connector exists but live path blocked

  const report = {
    target: TARGET,
    checkedAt: new Date().toISOString(),
    environment: {
      runner: process.env.GITHUB_ACTIONS ? "github-actions" : "local-or-cloud-agent",
      vercelEnv: process.env.VERCEL_ENV ?? null,
      node: process.version
    },
    connectivity,
    health,
    discoverError: discoverError ?? null,
    discoveredCount: documents.length,
    liveSuccessCount: successCount,
    liveDocuments: liveDocs,
    certification,
    notes: [
      "Fixtures are not counted as live evidence.",
      "LIVE_VERIFIED requires TLS+HTTP success and >=10 live documents.",
      "No CAPTCHA/WAF bypass or unofficial proxies were used."
    ]
  };

  const outDir = path.join(process.cwd(), "docs/rasd/reports");
  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `${TARGET}_LIVE_VERIFICATION_REPORT.json`);
  writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify({ certification, liveSuccessCount: successCount, outPath, tlsOk, httpOk }, null, 2));
  if (certification !== "LIVE_VERIFIED") process.exitCode = 2;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

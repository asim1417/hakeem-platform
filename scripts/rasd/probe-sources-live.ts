import { lookup } from "dns/promises";
import { mkdir, writeFile } from "fs/promises";
import net from "net";
import path from "path";
import tls from "tls";
import { getConnector } from "@/lib/modules/rasd/connectors";
import { rasdFetch } from "@/lib/modules/rasd/connectors/http";
import type { RasdSourceCode } from "@/lib/modules/rasd/types";

process.env.RASD_MEMORY_ONLY = "true";
process.env.RASD_FIXTURES_ONLY = "false";

const REPORT_PATH = path.join(process.cwd(), "docs/rasd/reports/live-source-probe.json");

const SOURCE_ENDPOINTS: Record<RasdSourceCode, string> = {
  BOE: "https://laws.boe.gov.sa/BoeLaws/Laws/LawsHome",
  NCAR: "https://ncar.gov.sa/",
  UQN: "https://www.uqn.gov.sa/sitemap_0.xml"
};

interface LayerProbe {
  ok: boolean;
  classification: string;
  detail?: string;
  status?: number;
  elapsedMs: number;
}

interface DocumentProbe {
  url: string;
  title?: string;
  sourceDocumentId?: string;
  http: LayerProbe;
}

interface SourceProbe {
  sourceCode: RasdSourceCode;
  endpoint: string;
  dns: LayerProbe;
  tcp: LayerProbe;
  tls: LayerProbe;
  http: LayerProbe;
  discovered: number;
  documents: DocumentProbe[];
  discoverError?: string;
}

function argLimit(): number {
  const index = process.argv.indexOf("--limit");
  const raw = index >= 0 ? process.argv[index + 1] : undefined;
  const parsed = Number(raw ?? "10");
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, 50) : 10;
}

function classifyError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const code = (error as NodeJS.ErrnoException).code;
  if (code) return code;
  if (error.name === "AbortError") return "TIMEOUT";
  return error.message;
}

async function time<T>(fn: () => Promise<T>): Promise<{ value?: T; error?: unknown; elapsedMs: number }> {
  const start = Date.now();
  try {
    return { value: await fn(), elapsedMs: Date.now() - start };
  } catch (error) {
    return { error, elapsedMs: Date.now() - start };
  }
}

async function probeDns(host: string): Promise<LayerProbe> {
  const result = await time(() => lookup(host, { all: true }));
  if (result.error || !result.value?.length) {
    return { ok: false, classification: "DNS_FAILED", detail: classifyError(result.error ?? "empty"), elapsedMs: result.elapsedMs };
  }
  const families = [...new Set(result.value.map((record) => `IPv${record.family}`))].sort();
  return { ok: true, classification: "DNS_OK", detail: `${result.value.length} record(s): ${families.join(",")}`, elapsedMs: result.elapsedMs };
}

function socketProbe(host: string, mode: "tcp" | "tls", timeoutMs = 8_000): Promise<LayerProbe> {
  const start = Date.now();
  return new Promise((resolve) => {
    let settled = false;
    const finish = (probe: Omit<LayerProbe, "elapsedMs">) => {
      if (settled) return;
      settled = true;
      resolve({ ...probe, elapsedMs: Date.now() - start });
    };

    let socket: net.Socket | tls.TLSSocket;
    if (mode === "tls") {
      socket = tls.connect({ host, port: 443, servername: host, timeout: timeoutMs }, () => {
        const secureSocket = socket as tls.TLSSocket;
        finish({ ok: true, classification: "TLS_OK", detail: secureSocket.getProtocol() ?? undefined });
        secureSocket.end();
      });
    } else {
      socket = net.connect({ host, port: 443, timeout: timeoutMs }, () => {
        finish({ ok: true, classification: "TCP_OK" });
        socket.end();
      });
    }

    socket.on("timeout", () => {
      finish({ ok: false, classification: mode === "tls" ? "TLS_TIMEOUT" : "TCP_TIMEOUT" });
      socket.destroy();
    });
    socket.on("error", (error) => {
      finish({ ok: false, classification: mode === "tls" ? "TLS_FAILED" : "TCP_FAILED", detail: classifyError(error) });
    });
  });
}

async function probeHttp(url: string, method: "GET" | "HEAD" = "HEAD"): Promise<LayerProbe> {
  const result = await time(() => rasdFetch(url, { method, timeoutMs: 15_000 }));
  if (result.error || !result.value) {
    return { ok: false, classification: "HTTP_FAILED", detail: classifyError(result.error), elapsedMs: result.elapsedMs };
  }
  return {
    ok: result.value.ok,
    classification: result.value.ok ? "HTTP_OK" : "HTTP_NON_2XX",
    detail: result.value.error ?? result.value.headers["content-type"],
    status: result.value.status,
    elapsedMs: result.elapsedMs
  };
}

async function probeSource(sourceCode: RasdSourceCode, limit: number): Promise<SourceProbe> {
  const endpoint = SOURCE_ENDPOINTS[sourceCode];
  const host = new URL(endpoint).hostname;
  const [dns, tcp, tlsResult, http] = await Promise.all([probeDns(host), socketProbe(host, "tcp"), socketProbe(host, "tls"), probeHttp(endpoint)]);
  const connector = getConnector(sourceCode);
  const discovered = await connector.discover({ limit }).catch((error: unknown) => ({
    sourceCode,
    ok: false,
    documents: [],
    pagesVisited: 0,
    error: classifyError(error)
  }));

  const documents: DocumentProbe[] = [];
  for (const document of discovered.documents.slice(0, limit)) {
    const httpProbe = await probeHttp(document.url, "GET");
    documents.push({
      url: document.url,
      title: document.title,
      sourceDocumentId: document.sourceDocumentId,
      http: httpProbe
    });
  }

  return {
    sourceCode,
    endpoint,
    dns,
    tcp,
    tls: tlsResult,
    http,
    discovered: discovered.documents.length,
    documents,
    discoverError: discovered.ok ? undefined : discovered.error
  };
}

async function main(): Promise<void> {
  const limit = argLimit();
  const sources: RasdSourceCode[] = ["BOE", "NCAR", "UQN"];
  const report = {
    generatedAt: new Date().toISOString(),
    mode: "MEMORY_ONLY",
    limit,
    sources: [] as SourceProbe[]
  };

  for (const source of sources) {
    report.sources.push(await probeSource(source, limit));
  }

  await mkdir(path.dirname(REPORT_PATH), { recursive: true });
  await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`Wrote ${REPORT_PATH}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

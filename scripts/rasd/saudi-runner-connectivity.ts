#!/usr/bin/env tsx
/**
 * Saudi-runner connectivity proof for BOE / NCAR / UQN.
 * Uses curl+openssl evidence AND the same Node rasdFetch path as connectors.
 * Never prints secrets or full egress IP in report files (hashed only).
 */
import { createHash } from "crypto";
import { lookup } from "dns/promises";
import { connect } from "net";
import { writeFileSync, mkdirSync } from "fs";
import path from "path";
import tls from "tls";
import { execFile } from "child_process";
import { promisify } from "util";
import { rasdFetch } from "@/lib/modules/rasd/connectors/http";
import type { RasdSourceCode } from "@/lib/modules/rasd/types";

const execFileAsync = promisify(execFile);

type HealthClass =
  | "HEALTHY"
  | "DEGRADED"
  | "TLS_BLOCKED"
  | "HTTP_BLOCKED"
  | "RATE_LIMITED"
  | "WAF_BLOCKED"
  | "UNREACHABLE";

const HOSTS: Record<RasdSourceCode, string[]> = {
  BOE: ["laws.boe.gov.sa", "boe.gov.sa"],
  NCAR: ["ncar.gov.sa", "www.ncar.gov.sa"],
  UQN: ["www.uqn.gov.sa", "uqn.gov.sa"]
};

function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex").slice(0, 12);
}

async function dnsProbe(host: string) {
  try {
    const records = await lookup(host, { all: true });
    return {
      ok: records.length > 0,
      addrs: records.map((r) => ({ family: r.family, hash: hashIp(r.address) }))
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function tcpProbe(host: string, port = 443, timeoutMs = 8000): Promise<{ ok: boolean; ms?: number; error?: string }> {
  return new Promise((resolve) => {
    const started = Date.now();
    const socket = connect({ host, port });
    const timer = setTimeout(() => {
      socket.destroy();
      resolve({ ok: false, error: "tcp_timeout", ms: Date.now() - started });
    }, timeoutMs);
    socket.once("connect", () => {
      clearTimeout(timer);
      const ms = Date.now() - started;
      socket.end();
      resolve({ ok: true, ms });
    });
    socket.once("error", (error) => {
      clearTimeout(timer);
      resolve({ ok: false, error: error.message, ms: Date.now() - started });
    });
  });
}

function tlsProbe(host: string, timeoutMs = 12000): Promise<{
  ok: boolean;
  ms?: number;
  protocol?: string | null;
  authorized?: boolean;
  error?: string;
}> {
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
      resolve({ ok: false, error: "tls_timeout", ms: Date.now() - started });
    }, timeoutMs);
    socket.once("secureConnect", () => {
      clearTimeout(timer);
      resolve({
        ok: true,
        ms: Date.now() - started,
        protocol: socket.getProtocol(),
        authorized: socket.authorized
      });
      socket.end();
    });
    socket.once("error", (error) => {
      clearTimeout(timer);
      resolve({ ok: false, error: error.message, ms: Date.now() - started });
    });
  });
}

async function opensslProbe(host: string) {
  try {
    const { stdout, stderr } = await execFileAsync(
      "openssl",
      ["s_client", "-connect", `${host}:443`, "-servername", host, "-brief"],
      { timeout: 15000, maxBuffer: 200_000 }
    );
    const out = `${stdout}\n${stderr}`;
    return {
      ok: /Verification:\s*OK|Protocol version|CONNECTION ESTABLISHED/i.test(out),
      sample: out.split("\n").slice(0, 12).join("\n")
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function curlProbe(url: string) {
  try {
    const { stdout } = await execFileAsync(
      "curl",
      [
        "-sS",
        "-L",
        "--max-redirs",
        "5",
        "-m",
        "20",
        "-A",
        "Hakeem-Rasd/1.0 (+legislative-monitoring)",
        "-o",
        "/dev/null",
        "-w",
        "%{http_code}|%{url_effective}|%{content_type}|%{time_total}|%{num_redirects}|%{ssl_verify_result}",
        url
      ],
      { timeout: 25000 }
    );
    const [httpCode, finalUrl, contentType, timeTotal, redirects, sslVerify] = stdout.trim().split("|");
    return {
      ok: Number(httpCode) >= 200 && Number(httpCode) < 400,
      httpCode: Number(httpCode),
      finalUrlHost: (() => {
        try {
          return new URL(finalUrl).hostname;
        } catch {
          return null;
        }
      })(),
      contentType: contentType || null,
      timeTotalSec: Number(timeTotal),
      redirects: Number(redirects),
      sslVerifyResult: Number(sslVerify)
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function nodeFetchProbe(url: string) {
  const started = Date.now();
  const result = await rasdFetch(url, { method: "GET", timeoutMs: 20_000 });
  return {
    ok: result.ok,
    status: result.status,
    error: result.error ?? null,
    contentType: result.headers["content-type"] ?? null,
    bodyBytes: result.bodyText?.length ?? 0,
    ms: Date.now() - started
  };
}

function classify(input: {
  dnsOk: boolean;
  tcpOk: boolean;
  tlsOk: boolean;
  httpOk: boolean;
  nodeOk: boolean;
  httpStatus?: number;
}): HealthClass {
  if (!input.dnsOk && !input.tcpOk) return "UNREACHABLE";
  if (input.dnsOk && !input.tcpOk) return "UNREACHABLE";
  if (input.tcpOk && !input.tlsOk) return "TLS_BLOCKED";
  if (input.tlsOk && !input.httpOk && !input.nodeOk) {
    if (input.httpStatus === 429) return "RATE_LIMITED";
    if (input.httpStatus === 403 || input.httpStatus === 503) return "WAF_BLOCKED";
    return "HTTP_BLOCKED";
  }
  if (input.tlsOk && (input.httpOk || input.nodeOk) && !(input.httpOk && input.nodeOk)) return "DEGRADED";
  if (input.tlsOk && input.httpOk && input.nodeOk) return "HEALTHY";
  return "DEGRADED";
}

async function probeSource(code: RasdSourceCode) {
  const hosts = HOSTS[code];
  const hostResults = [];
  for (const host of hosts) {
    const dns = await dnsProbe(host);
    const tcp = await tcpProbe(host);
    const tlsResult = tcp.ok ? await tlsProbe(host) : { ok: false, error: "skipped_tcp" };
    const openssl = await opensslProbe(host);
    const url = `https://${host}/`;
    const curl = await curlProbe(url);
    const node = tlsResult.ok ? await nodeFetchProbe(url) : { ok: false, status: 0, error: "skipped_tls", contentType: null, bodyBytes: 0, ms: 0 };
    hostResults.push({ host, dns, tcp, tls: tlsResult, openssl, curl, node });
  }

  const best = hostResults.reduce(
    (acc, row) => ({
      dnsOk: acc.dnsOk || Boolean(row.dns.ok),
      tcpOk: acc.tcpOk || Boolean(row.tcp.ok),
      tlsOk: acc.tlsOk || Boolean(row.tls.ok),
      httpOk: acc.httpOk || Boolean(row.curl.ok),
      nodeOk: acc.nodeOk || Boolean(row.node.ok),
      httpStatus: acc.httpStatus ?? ("httpCode" in row.curl ? row.curl.httpCode : undefined)
    }),
    { dnsOk: false, tcpOk: false, tlsOk: false, httpOk: false, nodeOk: false, httpStatus: undefined as number | undefined }
  );

  return {
    source: code,
    classification: classify(best),
    layers: best,
    hosts: hostResults
  };
}

async function main() {
  const runnerLabel = process.env.RASD_RUNNER_LABEL || "unspecified-runner";
  const regionHint = process.env.RASD_RUNNER_REGION || "unknown";
  const sources = (["BOE", "NCAR", "UQN"] as RasdSourceCode[]);
  const results = [];
  for (const source of sources) {
    results.push(await probeSource(source));
  }

  const report = {
    generatedAt: new Date().toISOString(),
    runnerLabel,
    regionHint,
    note: "Egress IP intentionally omitted from published report. Store privately if needed.",
    results,
    summary: Object.fromEntries(results.map((r) => [r.source, r.classification]))
  };

  const outDir = path.join(process.cwd(), "docs/rasd/reports");
  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "SAUDI_RUNNER_CONNECTIVITY_RAW.json");
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ outPath, summary: report.summary }, null, 2));

  const blocked = results.filter((r) => r.source !== "UQN" && r.classification !== "HEALTHY");
  if (blocked.length > 0) process.exitCode = 2;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

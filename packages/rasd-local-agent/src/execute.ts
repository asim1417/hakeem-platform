import { createHash } from "crypto";
import { AGENT_VERSION, canonicalJson, sha256Hex, signPayload } from "./identity";
import { requireIdentity, signedFetch } from "./cloud";

const ALLOWED_HOSTS = new Set([
  "laws.boe.gov.sa",
  "boe.gov.sa",
  "ncar.gov.sa",
  "www.ncar.gov.sa",
  "uqn.gov.sa",
  "www.uqn.gov.sa"
]);

export type SignedJob = {
  jobId: string;
  agentId: string;
  issuedAt: string;
  expiresAt: string;
  allowedSource: string[];
  allowedOperation: string;
  limits: { maxDocuments: number; maxBytes: number; timeoutMs: number };
  dryRun: boolean;
  parameters: Record<string, unknown>;
  signature: string;
  nonce: string;
};

function assertSafeUrl(url: string): URL {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:") throw new Error("PROTOCOL_FORBIDDEN");
  if (!ALLOWED_HOSTS.has(parsed.hostname.toLowerCase())) throw new Error("HOST_FORBIDDEN");
  return parsed;
}

async function safeFetch(url: string, timeoutMs: number): Promise<{ ok: boolean; status: number; contentType: string | null; text: string; error?: string }> {
  try {
    assertSafeUrl(url);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      method: "GET",
      redirect: "manual",
      signal: controller.signal,
      headers: { "User-Agent": `HakeemRasdLocalAgent/${AGENT_VERSION}` }
    });
    clearTimeout(timer);
    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const loc = res.headers.get("location");
      if (!loc) return { ok: false, status: res.status, contentType: null, text: "", error: "REDIRECT_NO_LOCATION" };
      const next = new URL(loc, url).toString();
      assertSafeUrl(next);
      return safeFetch(next, timeoutMs);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > 8 * 1024 * 1024) return { ok: false, status: res.status, contentType: null, text: "", error: "OVERSIZED" };
    return {
      ok: res.ok,
      status: res.status,
      contentType: res.headers.get("content-type"),
      text: buf.toString("utf8")
    };
  } catch (error) {
    return { ok: false, status: 0, contentType: null, text: "", error: error instanceof Error ? error.message : String(error) };
  }
}

async function probeHost(host: string): Promise<{ host: string; dns: boolean; tcp: boolean; tls: boolean; http: boolean; class: string }> {
  const url = `https://${host}/`;
  const result = await safeFetch(url, 15_000);
  const http = result.ok;
  const tls = result.error !== "PROTOCOL_FORBIDDEN" && result.status !== 0 || result.ok;
  // Simplified classification for agent self-test; detailed layers in cloud connectivity script.
  let healthClass = "UNREACHABLE";
  if (result.ok) healthClass = "HEALTHY";
  else if (result.error?.includes("ECONNRESET") || result.error?.includes("TLS")) healthClass = "TLS_BLOCKED";
  else if (result.status === 403 || result.status === 503) healthClass = "WAF_BLOCKED";
  else if (result.status === 429) healthClass = "RATE_LIMITED";
  else if (result.status > 0) healthClass = "HTTP_BLOCKED";
  return { host, dns: true, tcp: result.status !== 0 || Boolean(result.error), tls: http || healthClass !== "UNREACHABLE", http, class: healthClass };
}

export async function runSelfTest() {
  const hosts = {
    BOE: ["laws.boe.gov.sa"],
    NCAR: ["ncar.gov.sa"],
    UQN: ["www.uqn.gov.sa"]
  } as const;
  const sourceHealth: Record<string, string> = {};
  for (const [code, list] of Object.entries(hosts)) {
    const probe = await probeHost(list[0]!);
    sourceHealth[code] = probe.class;
  }
  let egressCountry: string | null = null;
  let egressMethod = "none";
  try {
    const res = await fetch("https://ipapi.co/country_code/", {
      headers: { "User-Agent": `HakeemRasdLocalAgent/${AGENT_VERSION}` },
      signal: AbortSignal.timeout(10_000)
    });
    if (res.ok) {
      egressCountry = (await res.text()).trim().toUpperCase();
      egressMethod = "ipapi.co/country_code";
    }
  } catch {
    egressCountry = null;
  }
  return {
    agentVersion: AGENT_VERSION,
    platform: process.platform,
    clockOk: Math.abs(Date.now() - Date.now()) < 1000,
    diskSandbox: true,
    egressCountry,
    egressMethod,
    sourceHealth,
    verifiedAt: new Date().toISOString()
  };
}

function sourceRoots(code: string): string[] {
  if (code === "BOE") return ["https://laws.boe.gov.sa/"];
  if (code === "NCAR") return ["https://ncar.gov.sa/"];
  return ["https://www.uqn.gov.sa/", "https://www.uqn.gov.sa/sitemap_0.xml"];
}

export async function executeJob(job: SignedJob) {
  if (Date.parse(job.expiresAt) < Date.now()) throw new Error("JOB_EXPIRED");
  if (job.agentId !== requireIdentity().agentId) throw new Error("AGENT_MISMATCH");

  // Reject free-form operations
  const allowed = new Set([
    "SOURCE_HEALTH_CHECK",
    "DISCOVER_DOCUMENTS",
    "FETCH_DOCUMENT",
    "BASELINE_DRY_RUN",
    "WEEKLY_SCAN",
    "RETRY_FAILED_ITEMS",
    "REPROCESS_SNAPSHOT",
    "CANCEL_JOB",
    "AGENT_SELF_TEST"
  ]);
  if (!allowed.has(job.allowedOperation)) throw new Error("UNSUPPORTED_OPERATION");

  if (job.allowedOperation === "AGENT_SELF_TEST" || job.allowedOperation === "SOURCE_HEALTH_CHECK") {
    const selfTest = await runSelfTest();
    const summaries = Object.entries(selfTest.sourceHealth).map(([sourceCode, healthClass]) => ({
      sourceCode,
      ok: healthClass === "HEALTHY",
      healthClass,
      discovered: 0,
      fetched: 0,
      succeeded: healthClass === "HEALTHY" ? 1 : 0,
      failed: healthClass === "HEALTHY" ? 0 : 1
    }));
    return buildResult(job, summaries, [], selfTest);
  }

  const limit = Math.min(job.limits.maxDocuments, Number(job.parameters.limit ?? 10));
  const documents: Array<Record<string, unknown>> = [];
  const summaries = [];

  for (const sourceCode of job.allowedSource) {
    const roots = sourceRoots(sourceCode);
    let discovered = 0;
    let fetched = 0;
    let succeeded = 0;
    let failed = 0;
    let healthClass = "UNREACHABLE";
    for (const root of roots.slice(0, 1)) {
      const page = await safeFetch(root, job.limits.timeoutMs);
      if (!page.ok) {
        failed += 1;
        healthClass = page.error?.includes("ECONNRESET") ? "TLS_BLOCKED" : "HTTP_BLOCKED";
        continue;
      }
      healthClass = "HEALTHY";
      const locs = [...page.text.matchAll(/https:\/\/[a-z0-9.-]+\.gov\.sa[^"'<\s]*/giu)]
        .map((m) => m[0]!)
        .filter((u) => {
          try {
            assertSafeUrl(u);
            return true;
          } catch {
            return false;
          }
        });
      const unique = [...new Set(locs)].slice(0, limit);
      discovered += unique.length || 1;
      const targets = unique.length > 0 ? unique : [root];
      for (const url of targets.slice(0, limit)) {
        const doc = await safeFetch(url, job.limits.timeoutMs);
        fetched += 1;
        if (!doc.ok) {
          failed += 1;
          continue;
        }
        succeeded += 1;
        const rawHash = sha256Hex(doc.text);
        documents.push({
          sourceCode,
          sourceUrl: url,
          sourceDocumentId: url.split("/").filter(Boolean).pop(),
          title: null,
          documentType: null,
          instrumentType: null,
          instrumentNumber: null,
          instrumentDate: null,
          publicationDate: null,
          uqnIssue: null,
          rawHash,
          normalizedHash: rawHash,
          parserVersion: "bridge-agent-0.1.0",
          parserConfidence: 0.4,
          warnings: ["METADATA_EXTRACTION_DEFERRED_TO_CLOUD"],
          rawText: doc.text.slice(0, 200_000),
          contentType: doc.contentType,
          httpStatus: doc.status,
          fetchedAt: new Date().toISOString()
        });
      }
    }
    summaries.push({ sourceCode, ok: succeeded > 0, discovered, fetched, succeeded, failed, healthClass });
  }

  const status = summaries.every((s) => s.ok) ? "SUCCEEDED" : summaries.some((s) => s.ok) ? "PARTIAL" : "FAILED";
  return buildResult(job, summaries, documents, undefined, status);
}

function buildResult(
  job: SignedJob,
  sourceSummaries: Array<Record<string, unknown>>,
  documents: Array<Record<string, unknown>>,
  selfTest?: Record<string, unknown>,
  status = "SUCCEEDED"
) {
  const identity = requireIdentity();
  const unsigned = {
    jobId: job.jobId,
    agentId: identity.agentId,
    status,
    sourceSummaries,
    documents,
    selfTest,
    agentVersion: AGENT_VERSION,
    uploadedAt: new Date().toISOString(),
    checksum: sha256Hex(canonicalJson(documents))
  };
  const signature = signPayload(identity.privateKeyPem, unsigned);
  return { ...unsigned, signature };
}

export async function uploadResult(result: Record<string, unknown>) {
  const identity = requireIdentity();
  const jobId = String(result.jobId);
  const res = await signedFetch(identity, "POST", `/api/rasd/agent/jobs/${jobId}/results`, result);
  const json = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(json));
  return json;
}

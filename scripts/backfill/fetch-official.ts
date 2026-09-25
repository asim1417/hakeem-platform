/**
 * جامع المصادر الرسمية للأنظمة السعودية.
 *
 * السياسة:
 * - NCAR: المصدر الأساسي للكوربوس. إن ضُبط NCAR_OPEN_DATA_URL يُعامل كمدخل بيانات مفتوحة
 *   ولا نفترض وجود API غير معلن. وإلا نقرأ فهرس الأنظمة واللوائح الرسمي ونستخرج روابطه.
 * - BOE: مصدر تحقق/مطابقة للنص المجمّع والتحديثات.
 * - UQN: لا كشط شامل؛ هذا السكربت لا يجمع منها. يبقى RSS المنشور في مساره المنفصل.
 *
 * Dry-run افتراضياً:
 *   npm run fetch:official
 * تنفيذ الجلب والحفظ:
 *   npm run fetch:official -- --apply --source=ncar --limit=100
 *   npm run fetch:official -- --apply --source=boe --limit=100
 *
 * المخرجات الخام خارج Git:
 *   data/backfill/official-raw/<source>/*.html|json|xml|csv
 *   data/backfill/official-raw/<source>/manifest.jsonl
 */
import { mkdir, appendFile, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import {
  assertOfficialSourceUrl,
  mayAutomateSource,
  sanitizeOfficialRequestHeaders,
  sha256Text,
} from "@/lib/modules/legal-core/official-source-policy";

import { discoverOfficialLinks, explicitCandidates, requireDiscoveredDocuments,
  type CollectableSource as Source, type OfficialCandidate as Candidate,
} from "@/lib/modules/legal-core/official-source-discovery";

const DIRECT_URLS = process.argv.filter((a) => a.startsWith("--url=")).map((a) => a.slice("--url=".length));
const APPLY = process.argv.includes("--apply");
const SOURCE_ARG = process.argv.find((a) => a.startsWith("--source="))?.split("=")[1]?.toLowerCase();
const LIMIT_ARG = Number(process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? "100");
const LIMIT = Number.isFinite(LIMIT_ARG) ? Math.max(1, Math.min(2000, LIMIT_ARG)) : 100;
const DELAY_MS = Math.max(500, Number(process.env.OFFICIAL_SOURCE_DELAY_MS ?? "1500"));
const MAX_BYTES = Math.max(1024 * 1024, Number(process.env.OFFICIAL_SOURCE_MAX_BYTES ?? String(12 * 1024 * 1024)));
const UA = process.env.OFFICIAL_SOURCE_USER_AGENT ?? "Hakeem-LegalData/1.0 (+https://hakeem.sa)";


const DEFAULT_INDEX: Record<Source, string> = {
  NCAR: "https://ncar.gov.sa/rules-regulations",
  BOE: "https://laws.boe.gov.sa/BoeLaws/Laws/LawsHome",
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function selectedSources(): Source[] {
  if (!SOURCE_ARG || SOURCE_ARG === "all") return ["NCAR", "BOE"];
  if (SOURCE_ARG === "ncar") return ["NCAR"];
  if (SOURCE_ARG === "boe") return ["BOE"];
  throw new Error("استخدم --source=ncar أو --source=boe أو --source=all");
}

async function getText(source: Source, rawUrl: string): Promise<{ text: string; contentType: string; status: number }> {
  const initial = assertOfficialSourceUrl(source, rawUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  try {
    const res = await fetch(initial, {
      redirect: "error",
      signal: controller.signal,
      headers: {
        "user-agent": UA,
        accept: "text/html,application/xhtml+xml,application/json,application/xml,text/csv,text/plain;q=0.9,*/*;q=0.5",
        ...sanitizeOfficialRequestHeaders(),
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${initial.hostname}`);
    const declared = Number(res.headers.get("content-length") ?? "0");
    if (declared > MAX_BYTES) throw new Error(`response too large: ${declared}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > MAX_BYTES) throw new Error(`response too large: ${buf.byteLength}`);
    return { text: buf.toString("utf8"), contentType: res.headers.get("content-type") ?? "", status: res.status };
  } finally {
    clearTimeout(timeout);
  }
}

function suffix(contentType: string, url: string): string {
  if (/json/i.test(contentType)) return ".json";
  if (/xml/i.test(contentType)) return ".xml";
  if (/csv/i.test(contentType)) return ".csv";
  const e = extname(new URL(url).pathname).toLowerCase();
  return [".json", ".xml", ".csv", ".txt", ".html", ".htm"].includes(e) ? e : ".html";
}

function safeFileStem(c: Candidate): string {
  const base = (c.id || sha256Text(c.url).slice(0, 20)).replace(/[^a-zA-Z0-9._-]/g, "_");
  return base.slice(0, 100);
}

async function save(source: Source, candidate: Candidate, text: string, contentType: string, status: number) {
  const dir = join(process.cwd(), "data/backfill/official-raw", source.toLowerCase());
  await mkdir(dir, { recursive: true });
  const hash = sha256Text(text);
  const file = safeFileStem(candidate) + "-" + hash.slice(0, 12) + suffix(contentType, candidate.url);
  await writeFile(join(dir, file), text, "utf8");
  const row = {
    source,
    url: candidate.url,
    title: candidate.title ?? null,
    sourceDocumentId: candidate.id ?? null,
    fetchedAt: new Date().toISOString(),
    httpStatus: status,
    contentType,
    sha256: hash,
    bytes: Buffer.byteLength(text, "utf8"),
    file,
  };
  await appendFile(join(dir, "manifest.jsonl"), JSON.stringify(row) + "\n", "utf8");
}

async function collectNcarOpenData(): Promise<boolean> {
  const raw = process.env.NCAR_OPEN_DATA_URL?.trim();
  if (!raw) return false;
  if (!mayAutomateSource("NCAR", true)) return false;
  const url = assertOfficialSourceUrl("NCAR", raw).toString();
  console.log(`NCAR_OPEN_DATA_URL مضبوط: ${url}`);
  if (!APPLY) return true;
  const res = await getText("NCAR", url);
  await save("NCAR", { source: "NCAR", url, title: "NCAR open data", id: "open-data" }, res.text, res.contentType, res.status);
  await recordRun("NCAR", { result: "ENTRY_SAVED_UNPARSED", fetched: 1, coverage: "NOT_VERIFIED", url });
  console.log(`✓ حُفظ مدخل البيانات المفتوحة — SHA256=${sha256Text(res.text).slice(0, 16)}…`);
  return true;
}

async function recordRun(source: Source, report: Record<string, unknown>) {
  const dir = join(process.cwd(), "data/backfill/official-raw", source.toLowerCase());
  await mkdir(dir, { recursive: true });
  await appendFile(join(dir, "runs.jsonl"), JSON.stringify({ source, finishedAt: new Date().toISOString(), ...report }) + "\n", "utf8");
}

async function collectIndex(source: Source) {
  const indexUrl = source === "NCAR" && process.env.NCAR_INDEX_URL
    ? process.env.NCAR_INDEX_URL
    : source === "BOE" && process.env.BOE_INDEX_URL
      ? process.env.BOE_INDEX_URL
      : DEFAULT_INDEX[source];
  const safeIndex = assertOfficialSourceUrl(source, indexUrl).toString();
  console.log(`[${source}] ${DIRECT_URLS.length ? "روابط مباشرة: " + DIRECT_URLS.length : "الفهرس: " + safeIndex}`);
  if (!APPLY) {
    console.log(`[${source}] معاينة فقط؛ لن تُرسل طلبات شبكة. الحد ${LIMIT}.`);
    return;
  }

  let discovered: Candidate[];
  if (DIRECT_URLS.length) {
    discovered = explicitCandidates(source, DIRECT_URLS);
  } else {
    const index = await getText(source, safeIndex);
    await save(source, { source, url: safeIndex, id: "index", title: "Discovery index (not a legal document)" }, index.text, index.contentType, index.status);
    discovered = discoverOfficialLinks(source, index.text, safeIndex);
  }
  requireDiscoveredDocuments(discovered);
  const candidates = discovered.slice(0, LIMIT);
  console.log(`[${source}] اكتُشف ${candidates.length} رابطًا مرشحًا.`);

  let ok = 0, failed = 0;
  const errors: Array<{ url: string; error: string }> = [];
  for (const candidate of candidates) {
    try {
      const res = await getText(source, candidate.url);
      await save(source, candidate, res.text, res.contentType, res.status);
      ok++;
      console.log(`  ✓ ${ok}/${candidates.length} ${candidate.title ?? candidate.id ?? candidate.url}`);
    } catch (error) {
      failed++;
      errors.push({ url: candidate.url, error: error instanceof Error ? error.message : String(error) });
      console.warn(`  ✗ ${candidate.url}: ${error instanceof Error ? error.message : String(error)}`);
    }
    await sleep(DELAY_MS);
  }
  await recordRun(source, { result: failed ? "PARTIAL_FAILURE" : "FETCHED_UNVERIFIED", discovered: discovered.length,
    attempted: candidates.length, fetched: ok, failed, deferred: discovered.length - candidates.length,
    coverage: "NOT_VERIFIED", errors });
  if (failed) process.exitCode = 1;
  console.log(`[${source}] تم: ${ok} · أخفق: ${failed} — اكتمال الكوربوس وسلامة النصوص لم يُتحقّق منهما.`);
}

async function main() {
  console.log(`جامع المصادر الرسمية — الوضع: ${APPLY ? "تنفيذ" : "dry-run"}`);
  console.log("UQN: مستبعد من الكشط الشامل؛ RSS المنشور له مسار منفصل.");

  const sources = selectedSources();
  if (DIRECT_URLS.length && sources.length !== 1) throw new Error("--url requires exactly one --source=ncar or --source=boe");
  // Validate every supplied URL before the first request or write.
  if (DIRECT_URLS.length) explicitCandidates(sources[0], DIRECT_URLS);
  for (const source of sources) {
    try {
      if (!DIRECT_URLS.length && source === "NCAR" && await collectNcarOpenData()) continue;
      await collectIndex(source);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      console.error(`[${source}] ${reason}`);
      if (APPLY) await recordRun(source, { result: "BLOCKED", error: reason, coverage: "NOT_VERIFIED" });
      process.exitCode = 1;
    }
  }
}

main().catch((error) => {
  console.error("✗", error instanceof Error ? error.message : error);
  process.exit(1);
});

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
  type OfficialLegalSource,
} from "@/lib/modules/legal-core/official-source-policy";

const APPLY = process.argv.includes("--apply");
const SOURCE_ARG = process.argv.find((a) => a.startsWith("--source="))?.split("=")[1]?.toLowerCase();
const LIMIT_ARG = Number(process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? "100");
const LIMIT = Number.isFinite(LIMIT_ARG) ? Math.max(1, Math.min(2000, LIMIT_ARG)) : 100;
const DELAY_MS = Math.max(500, Number(process.env.OFFICIAL_SOURCE_DELAY_MS ?? "1500"));
const MAX_BYTES = Math.max(1024 * 1024, Number(process.env.OFFICIAL_SOURCE_MAX_BYTES ?? String(12 * 1024 * 1024)));
const UA = process.env.OFFICIAL_SOURCE_USER_AGENT ?? "Hakeem-LegalData/1.0 (+https://hakeem.sa)";

type Source = Exclude<OfficialLegalSource, "UQN">;
type Candidate = { source: Source; url: string; title?: string; id?: string };

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

function stripTags(v: string): string {
  return v.replace(/<script[\s\S]*?<\/script>/giu, " ")
    .replace(/<style[\s\S]*?<\/style>/giu, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function discoverLinks(source: Source, html: string, baseUrl: string): Candidate[] {
  const out = new Map<string, Candidate>();
  for (const m of html.matchAll(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/giu)) {
    const href = m[1] ?? "";
    const title = stripTags(m[2] ?? "");
    let absolute: string;
    try { absolute = new URL(href, baseUrl).toString(); } catch { continue; }
    try { assertOfficialSourceUrl(source, absolute); } catch { continue; }

    const relevant = source === "BOE"
      ? /LawDetails|BoeLaws\/Laws/i.test(absolute)
      : /(document-details|rules-regulations|legislation|regulation)/i.test(absolute);
    if (!relevant) continue;
    if (title && !/(نظام|لائحة|تنظيم|قواعد|قرار|تعديل|وثيقة)/u.test(title) && source === "NCAR") continue;

    const u = new URL(absolute);
    const id = u.searchParams.get("lawId") ?? u.pathname.split("/").filter(Boolean).pop() ?? undefined;
    out.set(absolute, { source, url: absolute, title: title || undefined, id });
    if (out.size >= LIMIT) break;
  }
  return [...out.values()];
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
  console.log(`✓ حُفظ مدخل البيانات المفتوحة — SHA256=${sha256Text(res.text).slice(0, 16)}…`);
  return true;
}

async function collectIndex(source: Source) {
  const indexUrl = source === "NCAR" && process.env.NCAR_INDEX_URL
    ? process.env.NCAR_INDEX_URL
    : source === "BOE" && process.env.BOE_INDEX_URL
      ? process.env.BOE_INDEX_URL
      : DEFAULT_INDEX[source];
  const safeIndex = assertOfficialSourceUrl(source, indexUrl).toString();
  console.log(`[${source}] الفهرس: ${safeIndex}`);
  if (!APPLY) {
    console.log(`[${source}] معاينة فقط؛ لن تُرسل طلبات شبكة. الحد ${LIMIT}.`);
    return;
  }

  const index = await getText(source, safeIndex);
  const candidates = discoverLinks(source, index.text, safeIndex).slice(0, LIMIT);
  console.log(`[${source}] اكتُشف ${candidates.length} رابطًا مرشحًا.`);

  let ok = 0, failed = 0;
  for (const candidate of candidates) {
    try {
      const res = await getText(source, candidate.url);
      await save(source, candidate, res.text, res.contentType, res.status);
      ok++;
      console.log(`  ✓ ${ok}/${candidates.length} ${candidate.title ?? candidate.id ?? candidate.url}`);
    } catch (error) {
      failed++;
      console.warn(`  ✗ ${candidate.url}: ${error instanceof Error ? error.message : String(error)}`);
    }
    await sleep(DELAY_MS);
  }
  console.log(`[${source}] تم: ${ok} · أخفق: ${failed}`);
}

async function main() {
  console.log(`جامع المصادر الرسمية — الوضع: ${APPLY ? "تنفيذ" : "dry-run"}`);
  console.log("UQN: مستبعد من الكشط الشامل؛ RSS المنشور له مسار منفصل.");

  for (const source of selectedSources()) {
    if (source === "NCAR" && await collectNcarOpenData()) continue;
    await collectIndex(source);
  }
}

main().catch((error) => {
  console.error("✗", error instanceof Error ? error.message : error);
  process.exit(1);
});

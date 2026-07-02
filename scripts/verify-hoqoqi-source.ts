/**
 * verify-hoqoqi-source.ts — يتحقّق من **جودة نصّ المصدر الأصلي** (hoqoqi.sql) الذي استوردت منه
 * المنصّة مواد الأنظمة. يقرأ الملف كما هو، يفكّ INSERTات المواد بنفس منطق مُستورِد المنصّة
 * (نسخ حرفيّ للدوال النقيّة)، ثم يقيس: هل النصّ في المصدر نفسه يحوي كلمات ملتصقة/مقطوعة؟
 *
 * الغاية: الفصل الحاسم — إن وُجد الالتصاق في المصدر فهو **أصليّ** (لا تُلفّقه المنصّة)، والمنصّة
 * تعرضه كما هو مع فصل حدودٍ آمن فقط. قراءة فقط: لا قاعدة بيانات، لا كتابة.
 *
 * التشغيل: tsx scripts/verify-hoqoqi-source.ts --file=hoqoqi.sql
 * متغيّرات: HOQOQI_FILE (بديل --file)، SAMPLE_N=6، TOP_N=25، VERIFY_ARTICLES="1,5,12" (أرقام مواد للفحص)
 */
import fs from "node:fs/promises";
import path from "node:path";

// ── منطق التفكيك (منسوخ حرفيًّا من مُستورِد المنصّة لضمان مطابقة سلوك الاستيراد) ──
type SqlRow = Record<string, string | number | null>;
const targetTables = ["laws", "law_articles", "law_articles_lang", "lang_articles_law"];

function unescapeSqlChar(char: string) {
  const map: Record<string, string> = { n: "\n", r: "\r", t: "\t", "0": "\0" };
  return map[char] ?? char;
}
function coerceSqlValue(value: string): string | number | null {
  const trimmed = value.trim();
  if (!trimmed || /^null$/i.test(trimmed)) return null;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  return trimmed;
}
function rowFromValues(columns: string[], values: Array<string | number | null>): SqlRow {
  const row: SqlRow = {};
  values.forEach((value, index) => { row[columns[index] || `column_${index}`] = value; });
  return row;
}
function parseInsertValues(valuesSql: string) {
  const rows: Array<Array<string | number | null>> = [];
  let row: Array<string | number | null> = [];
  let value = ""; let inString = false; let escaping = false; let inRow = false;
  for (let index = 0; index < valuesSql.length; index += 1) {
    const char = valuesSql[index];
    if (inString) {
      if (escaping) { value += unescapeSqlChar(char); escaping = false; }
      else if (char === "\\") { escaping = true; }
      else if (char === "'") { inString = false; }
      else { value += char; }
      continue;
    }
    if (char === "'") { inString = true; continue; }
    if (char === "(" && !inRow) { inRow = true; row = []; value = ""; continue; }
    if (char === "," && inRow) { row.push(coerceSqlValue(value)); value = ""; continue; }
    if (char === ")" && inRow) { row.push(coerceSqlValue(value)); rows.push(row); row = []; value = ""; inRow = false; continue; }
    if (inRow) value += char;
  }
  return rows;
}
function parseSqlInserts(sql: string): Map<string, SqlRow[]> {
  const tables = new Map<string, SqlRow[]>();
  const insertRegex = /INSERT\s+INTO\s+`?([A-Za-z0-9_]+)`?\s*(?:\(([^)]+)\))?\s*VALUES\s*([\s\S]*?);/gi;
  let match: RegExpExecArray | null;
  while ((match = insertRegex.exec(sql))) {
    const table = match[1];
    if (!targetTables.includes(table)) continue;
    const columns = match[2]?.split(",").map((c) => c.replace(/[`"' ]/g, "").trim()) ?? [];
    const rows = parseInsertValues(match[3]).map((values) => rowFromValues(columns, values));
    tables.set(table, [...(tables.get(table) ?? []), ...rows]);
  }
  return tables;
}
function pick(row: SqlRow, keys: string[]) {
  const norm = new Map(Object.entries(row).map(([k, v]) => [k.toLowerCase(), v]));
  for (const key of keys) if (norm.has(key.toLowerCase())) return norm.get(key.toLowerCase());
  return undefined;
}
function strv(v: unknown) { return v === null || v === undefined ? "" : String(v).trim(); }

// ── كشف الالتصاق العربي↔العربي الحقيقي (بلا تطويل U+0640 وبلا أرقام) ──
const AR_LETTERS = /[ء-غف-يٮ-ۓەۮۯۺ-ۿ]/;
const ZERO_WIDTH = /[​-‍⁠﻿­]/;
const TATWEEL_RUN = /ـ{3,}/;
function longestArabicRun(s: string): { len: number; tok: string } {
  let best = { len: 0, tok: "" };
  for (const tok of s.split(/\s+/)) {
    let cur = 0, m = 0;
    for (const ch of tok) { if (AR_LETTERS.test(ch)) { cur += 1; if (cur > m) m = cur; } else cur = 0; }
    if (m > best.len) best = { len: m, tok };
  }
  return best;
}

async function main() {
  const fileArg = process.argv.find((a) => a.startsWith("--file="))?.slice(7);
  const file = fileArg || process.env.HOQOQI_FILE || "hoqoqi.sql";
  const SAMPLE_N = Number(process.env.SAMPLE_N || 6);
  const TOP_N = Number(process.env.TOP_N || 25);
  const wanted = (process.env.VERIFY_ARTICLES || "").split(",").map((s) => s.trim()).filter(Boolean);

  const buf = await fs.readFile(path.resolve(file));
  const sql = buf.toString("utf8");
  console.log("=".repeat(80));
  console.log(`مصدر: ${file} · الحجم: ${(buf.length / 1048576).toFixed(2)} ميغابايت`);
  console.log("=".repeat(80));

  const tables = parseSqlInserts(sql);
  const base = tables.get("law_articles") ?? [];
  const langRows = [...(tables.get("law_articles_lang") ?? []), ...(tables.get("lang_articles_law") ?? [])];
  const langById = new Map<string, SqlRow>();
  for (const r of langRows) {
    const aid = strv(pick(r, ["article_id", "id_article", "law_article_id"]));
    if (aid && !langById.has(aid)) langById.set(aid, r);
  }
  console.log(`جداول ملتقَطة: law_articles=${base.length} · lang=${langRows.length}`);

  type Art = { sourceId: string; num: string; content: string };
  const arts: Art[] = base.map((row, i) => {
    const sourceId = strv(pick(row, ["id", "article_id", "id_article", "law_article_id"])) || `row_${i}`;
    const lang = langById.get(sourceId);
    const num = strv(pick(row, ["article_number", "number", "no", "article_no", "sort", "order"])) ||
      strv(pick(lang ?? {}, ["title", "name", "article_title", "lang_title"])) || sourceId;
    const content = strv(pick(lang ?? {}, ["content", "text", "article", "article_text", "body", "lang_text"]));
    return { sourceId, num, content };
  }).filter((a) => a.content);

  const totalChars = arts.reduce((n, a) => n + a.content.length, 0);
  console.log(`مواد بنصّ: ${arts.length} · مجموع المحارف: ${totalChars.toLocaleString("en")}\n`);

  // مقاييس جودة نصّ المصدر نفسه
  let glued = 0, tatweel = 0, zw = 0;
  const offenders: Array<{ sourceId: string; num: string; len: number; tok: string }> = [];
  for (const a of arts) {
    if (TATWEEL_RUN.test(a.content)) tatweel += 1;
    if (ZERO_WIDTH.test(a.content)) zw += 1;
    const run = longestArabicRun(a.content);
    if (run.len > 28) { glued += 1; offenders.push({ sourceId: a.sourceId, num: a.num, len: run.len, tok: run.tok.slice(0, 70) }); }
  }
  console.log("— جودة نصّ المصدر (hoqoqi.sql) نفسه —");
  console.log(`  التصاق عربي↔عربي حقيقي (>28 حرفًا بلا فراغ): ${glued} مادة`);
  console.log(`  تطويل مفرط (كشيدة ≥3): ${tatweel} مادة`);
  console.log(`  محارف صفرية العرض/soft-hyphen: ${zw} مادة`);
  console.log(`  ⇐ هذه إن وُجدت فهي في المصدر أصلاً (استوردتها المنصّة حرفيًّا، وتعرضها مع فصل حدود آمن فقط).\n`);

  if (offenders.length) {
    offenders.sort((a, b) => b.len - a.len);
    console.log(`— أطول ${Math.min(TOP_N, offenders.length)} حالات التصاق في المصدر —`);
    for (const o of offenders.slice(0, TOP_N)) console.log(`  [${o.len}] مادة#${o.num} (src ${o.sourceId}): «${o.tok}»`);
    console.log("");
  }

  console.log(`— عيّنة نصوص من المصدر (أول ${SAMPLE_N} مواد) للمعاينة البصرية —`);
  for (const a of arts.slice(0, SAMPLE_N)) {
    console.log(`  • مادة#${a.num} (src ${a.sourceId}): «${a.content.slice(0, 240).replace(/\n/g, " ⏎ ")}»`);
  }

  if (wanted.length) {
    console.log(`\n— فحص مواد محدّدة (${wanted.join(", ")}) —`);
    for (const w of wanted) {
      const hit = arts.find((a) => a.num === w || a.sourceId === w);
      console.log(hit ? `  • مادة#${hit.num} (src ${hit.sourceId}): «${hit.content.slice(0, 400).replace(/\n/g, " ⏎ ")}»` : `  • ${w}: غير موجودة`);
    }
  }
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });

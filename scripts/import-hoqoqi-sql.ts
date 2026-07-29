import { PrismaClient } from "@prisma/client";
import fs from "node:fs/promises";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import { PREAMBLE_ARTICLE_NUMBER, PREAMBLE_TITLE } from "@/lib/modules/legal-core/article-ref";

const prisma = new PrismaClient();
const checkpointPath = path.join(process.cwd(), ".import-hoqoqi-checkpoint.json");

type SqlRow = Record<string, string | number | null>;
type ParsedSql = {
  tables: Map<string, SqlRow[]>;
  tableNames: string[];
};

type HoqoqiSystem = {
  sourceId: string;
  name: string;
  classification?: string;
  description?: string;
  // ── ما قبل المادة (HKM-LAW-PREAMBLE-002): يُحفظ لا يُسقَط ──
  preamble?: string; // نصّ ديباجة النظام (laws_lang.law_preamble)
  kingName?: string; // اسم الملك المُصدِر (laws_lang.king_name)
  royalDecree?: string; // مرجع أداة الإصدار (law_issuance_tools.title)
  instrumentText?: string; // نصّ أداة الإصدار كاملًا (law_issuance_tools.title)
  issueDateH?: string; // تاريخ الإصدار الهجريّ (laws.issuance_date_hj)
  effectiveFrom?: string; // تاريخ الإصدار الميلاديّ (laws.issuance_date_gr) — ISO
};

type HoqoqiArticle = {
  sourceId: string;
  sourceSystemId: string;
  lawName?: string;
  articleNumber?: number;
  articleNumberText?: string;
  title?: string;
  content: string;
  chapter?: string;
  classification?: string;
  keywords: string[];
  royalDecree?: string; // للديباجة/المادة حين تُعرف أداة الإصدار
  effectiveFrom?: string; // تاريخ نفاذ النظام الميلاديّ (ISO) — من laws.issuance_date_gr
};

type ImportModel = {
  systems: HoqoqiSystem[];
  articles: HoqoqiArticle[];
  categories: Map<string, string>;
  nounsCount: number;
  verbsCount: number;
  invalidArticles: string[];
  duplicateArticles: string[];
};

type ImportOptions = {
  apply: boolean;
  inputPath: string;
  batchSize: number;
  resume: boolean;
  resetCheckpoint: boolean;
};

type ImportCheckpoint = {
  startedAt: string;
  lastSystemIndex: number;
  lastArticleIndex: number;
  importedSystems: number;
  importedArticles: number;
  skippedArticles: number;
  failedArticles: number;
  failedArticleIds: string[];
  completed: boolean;
  lastUpdatedAt: string;
};

const targetTables = [
  "laws",
  "laws_lang",
  "lang_laws",
  "law_articles",
  "law_articles_lang",
  "lang_articles_law",
  "law_categories",
  "law_categories_lang",
  "lang_categories_law",
  "law_chapters",
  "law_chapters_lang",
  // أسماء hoqoqi الحقيقيّة (من فحص البنية): أداة الإصدار والتعديلات.
  "law_issuance_tools",
  "law_articles_amendment",
  "law_articles_amendment_lang",
  "nouns",
  "verbs"
];

async function main() {
  const options = await resolveOptions(process.argv.slice(2));

  if (options.resetCheckpoint) {
    await fs.rm(checkpointPath, { force: true });
    console.log(`تم حذف checkpoint: ${checkpointPath}`);
  }

  const sql = await readSqlFromZip(options.inputPath);
  const parsed = parseSqlInserts(sql);
  const model = buildImportModel(parsed);

  printReport(options.inputPath, parsed, model, options.apply);

  if (!options.apply) {
    console.log("وضع الفحص فقط. لم يتم إدخال أي بيانات. أعد التشغيل مع --apply عند التأكد من DATABASE_URL.");
    return;
  }

  await importModel(model, options);
}

async function resolveOptions(args: string[]): Promise<ImportOptions> {
  const resetCheckpoint = args.includes("--reset-checkpoint");
  const checkpointExists = await fileExists(checkpointPath);
  return {
    apply: args.includes("--apply"),
    inputPath: resolveInputPath(args),
    batchSize: parsePositiveOption(args, "--batch-size", 250),
    resume: args.includes("--resume") || (checkpointExists && !resetCheckpoint),
    resetCheckpoint
  };
}

function resolveInputPath(args: string[]) {
  const explicit = args.find((arg) => arg.startsWith("--file="))?.slice("--file=".length);
  const positional = args.find((arg) => !arg.startsWith("--"));
  return path.resolve(process.cwd(), explicit || positional || "hoqoqi.sql.zip");
}

function parsePositiveOption(args: string[], name: string, fallback: number) {
  const raw = args.find((arg) => arg.startsWith(`${name}=`))?.slice(name.length + 1);
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

export async function readSqlFromZip(filePath: string) {
  const buffer = await fs.readFile(filePath).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") {
      throw new Error(`لم يتم العثور على ملف حقوقي: ${filePath}`);
    }
    throw error;
  });

  if (path.extname(filePath).toLowerCase() === ".sql") return buffer.toString("utf8");

  const entries = readZipEntries(buffer);
  const sqlEntry = entries.find((entry) => entry.name.toLowerCase().endsWith(".sql"));
  if (!sqlEntry) throw new Error("ملف ZIP لا يحتوي على ملف SQL.");
  return sqlEntry.data.toString("utf8");
}

function readZipEntries(buffer: Buffer) {
  const eocdOffset = findEndOfCentralDirectory(buffer);
  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
  const entries: Array<{ name: string; data: Buffer }> = [];
  let cursor = centralDirectoryOffset;

  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(cursor) !== 0x02014b50) throw new Error("تعذر قراءة فهرس ملف ZIP.");
    const compression = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const fileNameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localHeaderOffset = buffer.readUInt32LE(cursor + 42);
    const name = buffer.subarray(cursor + 46, cursor + 46 + fileNameLength).toString("utf8");

    const localNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
    const compressed = buffer.subarray(dataStart, dataStart + compressedSize);
    const data = compression === 0 ? compressed : compression === 8 ? zlib.inflateRawSync(compressed) : Buffer.alloc(0);
    entries.push({ name, data });
    cursor += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

function findEndOfCentralDirectory(buffer: Buffer) {
  for (let index = buffer.length - 22; index >= Math.max(0, buffer.length - 66000); index -= 1) {
    if (buffer.readUInt32LE(index) === 0x06054b50) return index;
  }
  throw new Error("تعذر قراءة ملف ZIP: لم يتم العثور على نهاية الفهرس.");
}

export function parseSqlInserts(sql: string): ParsedSql {
  const tables = new Map<string, SqlRow[]>();
  const tableNames = Array.from(sql.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`?([A-Za-z0-9_]+)`?/gi)).map((match) => match[1]);
  const insertRegex = /INSERT\s+INTO\s+`?([A-Za-z0-9_]+)`?\s*(?:\(([^)]+)\))?\s*VALUES\s*([\s\S]*?);/gi;
  let match: RegExpExecArray | null;

  while ((match = insertRegex.exec(sql))) {
    const table = match[1];
    if (!targetTables.includes(table)) continue;
    const columns = match[2]?.split(",").map((column) => column.replace(/[`"' ]/g, "").trim()) ?? [];
    const rows = parseInsertValues(match[3]).map((values) => rowFromValues(columns, values));
    tables.set(table, [...(tables.get(table) ?? []), ...rows]);
  }

  return { tables, tableNames: Array.from(new Set(tableNames)) };
}

function parseInsertValues(valuesSql: string) {
  const rows: Array<Array<string | number | null>> = [];
  let row: Array<string | number | null> = [];
  let value = "";
  let inString = false;
  let escaping = false;
  let inRow = false;

  for (let index = 0; index < valuesSql.length; index += 1) {
    const char = valuesSql[index];
    if (inString) {
      if (escaping) {
        value += unescapeSqlChar(char);
        escaping = false;
      } else if (char === "\\") {
        escaping = true;
      } else if (char === "'") {
        inString = false;
      } else {
        value += char;
      }
      continue;
    }

    if (char === "'") {
      inString = true;
      continue;
    }
    if (char === "(" && !inRow) {
      inRow = true;
      row = [];
      value = "";
      continue;
    }
    if (char === "," && inRow) {
      row.push(coerceSqlValue(value));
      value = "";
      continue;
    }
    if (char === ")" && inRow) {
      row.push(coerceSqlValue(value));
      rows.push(row);
      row = [];
      value = "";
      inRow = false;
      continue;
    }
    if (inRow) value += char;
  }

  return rows;
}

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
  values.forEach((value, index) => {
    row[columns[index] || `column_${index}`] = value;
  });
  return row;
}

export function buildImportModel(parsed: ParsedSql): ImportModel {
  const categories = buildCategories(parsed);
  const systems = buildSystems(parsed, categories);
  // أداة الإصدار (المراسيم) — تُدمَج في الأنظمة فلا تُسقَط (كانت تُعدّ ولا تُربَط).
  mergeIssuanceInstruments(systems, buildIssuanceInstruments(parsed));
  const bodyArticles = buildArticles(parsed, systems, categories);
  // الديباجة/أداة الإصدار مادّةً رقم صفر — كي تركب خطّ الأنابيب (بحث/تضمين/استشهاد) دون إسقاط.
  const preambleArticles = buildPreambleArticles(systems);
  const articles = [...preambleArticles, ...bodyArticles];

  // مادّة صالحة: لها نظام ونصّ ورقمٌ **منتهٍ** (0 للديباجة مقبولٌ — لا نُسقطه بشرط الصدق «truthy»).
  const isValid = (a: HoqoqiArticle) => Boolean(a.sourceSystemId) && Boolean(a.content) && Number.isFinite(a.articleNumber);
  const duplicateArticles = findDuplicateArticleKeys(articles);
  const invalidArticles = articles.filter((article) => !isValid(article)).map((article) => article.sourceId);

  return {
    systems,
    articles: articles.filter(isValid),
    categories,
    nounsCount: (parsed.tables.get("nouns") ?? []).length,
    verbsCount: (parsed.tables.get("verbs") ?? []).length,
    invalidArticles,
    duplicateArticles
  };
}

/** يستخرج أداة الإصدار لكلّ نظام من law_issuance_tools (law_id, title) — الاسم الحقيقيّ في hoqoqi. */
export function buildIssuanceInstruments(parsed: ParsedSql): Map<string, { royalDecree?: string; instrumentText?: string }> {
  const byLaw = new Map<string, { royalDecree?: string; instrumentText?: string }>();
  for (const row of parsed.tables.get("law_issuance_tools") ?? []) {
    const lawId = stringValue(pick(row, ["law_id", "id_law", "laws_id"]));
    if (!lawId) continue;
    const title = stringValue(pick(row, ["title", "text", "tool_title", "name", "content"]));
    if (!title) continue;
    const prev = byLaw.get(lawId);
    // نجمع أدوات الإصدار المتعدّدة لنظامٍ واحد (قد يكون له مرسوم + قرار…).
    const merged = prev?.instrumentText ? `${prev.instrumentText}\n${title}` : title;
    byLaw.set(lawId, { royalDecree: prev?.royalDecree || title.slice(0, 160), instrumentText: merged });
  }
  return byLaw;
}

function mergeIssuanceInstruments(systems: HoqoqiSystem[], instruments: ReturnType<typeof buildIssuanceInstruments>) {
  for (const system of systems) {
    const inst = instruments.get(system.sourceId);
    if (!inst) continue;
    system.royalDecree = system.royalDecree || inst.royalDecree;
    system.instrumentText = system.instrumentText || inst.instrumentText;
  }
}

/**
 * يبني «مادّة الديباجة» (رقم صفر) لكلّ نظامٍ له نصّ ديباجةٍ أو أداة إصدار — بنصّه الخام دون
 * إعادة صياغة. لا يُنشئ ديباجةً لنظامٍ بلا مصدرٍ لها (منع الاختلاق).
 */
export function buildPreambleArticles(systems: HoqoqiSystem[]): HoqoqiArticle[] {
  const out: HoqoqiArticle[] = [];
  for (const s of systems) {
    const parts: string[] = [];
    if (s.preamble?.trim()) parts.push(s.preamble.trim());
    // كتلة أداة الإصدار: الملك + المرسوم/القرار (نصّه الكامل) + التاريخان (هجريّ/ميلاديّ).
    const instrumentLines = [
      s.kingName?.trim() ? `المُصدِر: ${s.kingName.trim()}` : "",
      s.instrumentText?.trim() ? `أداة الإصدار:\n${s.instrumentText.trim()}` : "",
      s.issueDateH ? `تاريخ الإصدار (هجريّ): ${s.issueDateH}` : "",
      s.effectiveFrom ? `تاريخ الإصدار (ميلاديّ): ${s.effectiveFrom}` : ""
    ].filter(Boolean);
    if (instrumentLines.length) parts.push(instrumentLines.join("\n"));
    const content = parts.join("\n\n").trim();
    if (!content) continue; // بلا نصّ ⇒ لا ديباجة (لا نختلق)
    out.push({
      sourceId: `preamble:${s.sourceId}`,
      sourceSystemId: s.sourceId,
      lawName: s.name,
      articleNumber: PREAMBLE_ARTICLE_NUMBER,
      articleNumberText: String(PREAMBLE_ARTICLE_NUMBER),
      title: PREAMBLE_TITLE,
      content,
      classification: s.classification,
      royalDecree: s.royalDecree,
      effectiveFrom: s.effectiveFrom,
      keywords: ["source:hoqoqi_sql", "review:needs_review", "type:preamble"]
    });
  }
  return out;
}

function buildCategories(parsed: ParsedSql) {
  const categories = new Map<string, string>();
  for (const table of ["law_categories", "law_categories_lang", "lang_categories_law"]) {
    for (const row of parsed.tables.get(table) ?? []) {
      const id = stringValue(pick(row, ["id", "category_id", "id_category", "law_category_id"]));
      const name = stringValue(pick(row, ["name", "title", "category_name", "lang_name", "ar_name"]));
      if (id && name) categories.set(id, name);
    }
  }
  return categories;
}

function buildSystems(parsed: ParsedSql, categories: Map<string, string>) {
  const baseRows = parsed.tables.get("laws") ?? [];
  const langRows = [...(parsed.tables.get("laws_lang") ?? []), ...(parsed.tables.get("lang_laws") ?? [])];
  const systems = new Map<string, HoqoqiSystem>();

  for (const row of baseRows) {
    const sourceId = stringValue(pick(row, ["id", "law_id", "id_law", "laws_id"]));
    if (!sourceId) continue;
    const categoryId = stringValue(pick(row, ["category_id", "law_category_id", "id_category"]));
    const description = stringValue(pick(row, ["description", "summary", "details", "intro"]));
    const current = systems.get(sourceId);
    // تواريخ الإصدار من جدول laws نفسه (الهجريّ + الميلاديّ الحقيقيّ) — لا تُسقَط.
    const dateH = stringValue(pick(row, ["issuance_date_hj", "issue_date_h", "date_h"]));
    const dateG = stringValue(pick(row, ["issuance_date_gr", "issue_date_g", "date_g"]));
    systems.set(sourceId, {
      ...current,
      sourceId,
      name: current?.name ?? "",
      classification: current?.classification ?? (categoryId ? categories.get(categoryId) : undefined),
      description: current?.description ?? description,
      issueDateH: current?.issueDateH || dateH || undefined,
      effectiveFrom: current?.effectiveFrom || dateG || undefined
    });
  }

  for (const row of langRows) {
    const sourceId = stringValue(pick(row, ["law_id", "id_law", "laws_id"]));
    const name = stringValue(pick(row, ["title", "name", "law_name", "lang_name", "ar_name"]));
    if (!sourceId || !name) continue;
    const current = systems.get(sourceId);
    // الديباجة (law_preamble) واسم الملك (king_name) — يُحفظان لا يُطويان في description ثمّ يُرميان.
    const preamble = stringValue(pick(row, ["law_preamble", "preamble", "recitals", "intro_text"]));
    const kingName = stringValue(pick(row, ["king_name", "king", "issuer_name"]));
    systems.set(sourceId, {
      ...current,
      sourceId,
      name,
      classification: current?.classification,
      description: current?.description ?? stringValue(pick(row, ["description", "summary", "details", "intro"])),
      preamble: current?.preamble || preamble || undefined,
      kingName: current?.kingName || kingName || undefined
    });
  }

  return Array.from(systems.values()).filter((system) => system.name);
}

function buildArticles(parsed: ParsedSql, systems: HoqoqiSystem[], categories: Map<string, string>) {
  const systemNames = new Map(systems.map((system) => [system.sourceId, system.name]));
  // مرسوم/تاريخ النظام يُنسبان لكلّ مادّةٍ فيه (حقلٌ لكلّ مادّة) — فيصير كلّ نصٍّ قابلًا للنسبة لأداته.
  const systemMeta = new Map(systems.map((s) => [s.sourceId, { royalDecree: s.royalDecree, effectiveFrom: s.effectiveFrom }]));
  const baseRows = parsed.tables.get("law_articles") ?? [];
  const langRows = [...(parsed.tables.get("law_articles_lang") ?? []), ...(parsed.tables.get("lang_articles_law") ?? [])];
  const langByArticleId = new Map<string, SqlRow>();
  for (const row of langRows) {
    const articleId = stringValue(pick(row, ["article_id", "id_article", "law_article_id"]));
    if (articleId && !langByArticleId.has(articleId)) langByArticleId.set(articleId, row);
  }

  const articles = baseRows.map((row, index): HoqoqiArticle => {
    const sourceId = stringValue(pick(row, ["id", "article_id", "id_article", "law_article_id"])) || `row_${index}`;
    const langRow = langByArticleId.get(sourceId);
    const sourceSystemId = stringValue(pick(row, ["law_id", "id_law", "laws_id", "system_id"]));
    const categoryId = stringValue(pick(row, ["category_id", "law_category_id", "id_category"]));
    const articleNumberText =
      stringValue(pick(row, ["article_number", "number", "no", "article_no", "sort", "order"])) ||
      stringValue(pick(langRow ?? {}, ["title", "name", "article_title", "lang_title"])) ||
      sourceId;
    const content = stringValue(pick(langRow ?? {}, ["content", "text", "article", "article_text", "body", "lang_text"]));
    const title = stringValue(pick(langRow ?? {}, ["title", "name", "article_title", "lang_title"]));
    const chapter = stringValue(pick(row, ["chapter", "section", "part", "door", "bab", "chapter_id"]));

    return {
      sourceId,
      sourceSystemId,
      lawName: systemNames.get(sourceSystemId),
      articleNumber: parseArticleNumber(articleNumberText),
      articleNumberText,
      title: title || (articleNumberText ? `المادة ${articleNumberText}` : "مادة نظامية"),
      content,
      chapter,
      classification: categoryId ? categories.get(categoryId) : undefined,
      royalDecree: systemMeta.get(sourceSystemId)?.royalDecree,
      effectiveFrom: systemMeta.get(sourceSystemId)?.effectiveFrom,
      keywords: ["source:hoqoqi_sql", "review:needs_review", articleNumberText ? `article:${articleNumberText}` : ""].filter(Boolean)
    };
  });

  const sequenceBySystem = new Map<string, number>();
  return articles.map((article) => {
    const current = (sequenceBySystem.get(article.sourceSystemId) ?? 0) + 1;
    sequenceBySystem.set(article.sourceSystemId, current);
    return {
      ...article,
      articleNumber: article.articleNumber ?? current,
      keywords: [...article.keywords, `source_article_id:${article.sourceId}`]
    };
  });
}

function parseArticleNumber(value: string) {
  const englishDigits = value.replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
  const match = englishDigits.match(/\d+/);
  if (match) return Number(match[0]);
  // لا أرقام رقمية ⇒ جرّب العنوان الترتيبي العربي («المادة الخامسة والأربعون بعد المائة» = 145)
  return parseArabicOrdinal(value);
}

// خرائط الأعداد الترتيبية العربية (بعد التطبيع: بلا تشكيل، الهمزات→ا، ة→ه، ى→ي).
const AR_UNITS: Record<string, number> = {
  "اول": 1, "اولي": 1, "حادي": 1, "حاديه": 1, "واحد": 1, "واحده": 1,
  "ثاني": 2, "ثانيه": 2, "اثنان": 2, "اثنتان": 2,
  "ثالث": 3, "ثالثه": 3, "رابع": 4, "رابعه": 4, "خامس": 5, "خامسه": 5,
  "سادس": 6, "سادسه": 6, "سابع": 7, "سابعه": 7, "ثامن": 8, "ثامنه": 8,
  "تاسع": 9, "تاسعه": 9, "عاشر": 10, "عاشره": 10,
};
const AR_TENS: Record<string, number> = {
  "عشرون": 20, "عشرين": 20, "ثلاثون": 30, "ثلاثين": 30, "اربعون": 40, "اربعين": 40,
  "خمسون": 50, "خمسين": 50, "ستون": 60, "ستين": 60, "سبعون": 70, "سبعين": 70,
  "ثمانون": 80, "ثمانين": 80, "تسعون": 90, "تسعين": 90,
};
const AR_HUNDREDS: Record<string, number> = {
  "مايه": 100, "مايتان": 200, "مايتين": 200, "ثلاثمايه": 300, "اربعمايه": 400,
  "خمسمايه": 500, "ستمايه": 600, "سبعمايه": 700, "ثمانمايه": 800, "تسعمايه": 900,
};

/** يحوّل عنوان مادة عربيًّا ترتيبيًّا إلى رقم صحيح؛ يُعيد undefined إن تعذّر. */
export function parseArabicOrdinal(raw: string): number | undefined {
  let s = raw
    .replace(/[ً-ْٰـ]/g, "")
    .replace(/[إأآ]/g, "ا").replace(/ئ/g, "ي").replace(/ؤ/g, "و").replace(/ء/g, "")
    .replace(/ى/g, "ي").replace(/ة/g, "ه")
    .replace(/[«»(){}\[\].,،؛]/g, " ");
  s = s.replace(/الماده/g, " ").replace(/مكرر/g, " ");
  const words = s.split(/\s+/).map((w) => w.replace(/^و?ال/, "").replace(/^و/, "")).filter(Boolean);
  if (!words.length) return undefined;

  let hundreds = 0, tens = 0, units = 0, teen = 0, sawAny = false;
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (w in AR_HUNDREDS) { hundreds += AR_HUNDREDS[w]; sawAny = true; continue; }
    if (w === "بعد") continue; // «بعد المائة» = وجود المئة كإزاحة
    if (w in AR_TENS) { tens += AR_TENS[w]; sawAny = true; continue; }
    if (w in AR_UNITS) {
      const next = words[i + 1];
      if (next === "عشر" || next === "عشره") { teen += 10 + AR_UNITS[w]; i++; sawAny = true; continue; }
      units += AR_UNITS[w]; sawAny = true; continue;
    }
    if (w === "عشر" || w === "عشره") { teen += 10; sawAny = true; continue; }
  }
  if (!sawAny) return undefined;
  const total = hundreds + tens + teen + units;
  return total > 0 ? total : undefined;
}

function findDuplicateArticleKeys(articles: HoqoqiArticle[]) {
  const seen = new Set<string>();
  const duplicate = new Set<string>();
  for (const article of articles) {
    if (!article.sourceSystemId || !article.articleNumber) continue;
    const key = `${article.sourceSystemId}:${article.articleNumber}`;
    if (seen.has(key)) duplicate.add(key);
    seen.add(key);
  }
  return Array.from(duplicate);
}

async function importModel(model: ImportModel, options: ImportOptions) {
  const startedAt = Date.now();
  const checkpoint = options.resume ? await loadCheckpoint() : createCheckpoint();
  checkpoint.completed = false;
  await saveCheckpoint(checkpoint);

  console.log(`Checkpoint: ${checkpointPath}`);
  console.log(`Batch size: ${options.batchSize}`);
  console.log(`Resume mode: ${options.resume ? "enabled" : "disabled"}`);

  const articleCountBySystem = countArticlesBySystem(model.articles);
  await importSystems(model, articleCountBySystem, checkpoint);
  const systemIdBySource = await loadSystemIds(model.systems);
  await importArticles(model, systemIdBySource, checkpoint, options, startedAt);

  checkpoint.completed = checkpoint.lastArticleIndex >= model.articles.length;
  checkpoint.lastUpdatedAt = new Date().toISOString();
  await saveCheckpoint(checkpoint);

  console.log("تقرير الاستيراد النهائي");
  console.log(
    JSON.stringify(
      {
        systemsDiscovered: model.systems.length,
        systemsImportedOrSeen: checkpoint.importedSystems,
        articlesDiscovered: model.articles.length,
        articlesImported: checkpoint.importedArticles,
        skippedDuplicates: checkpoint.skippedArticles,
        failedArticles: checkpoint.failedArticles,
        invalidArticles: model.invalidArticles.length,
        duplicateArticleKeys: model.duplicateArticles.length,
        completed: checkpoint.completed,
        checkpoint: checkpointPath
      },
      null,
      2
    )
  );

  if (!checkpoint.completed) {
    console.log("توقف الاستيراد مع حفظ checkpoint. أعد التشغيل بالأمر: npm run import:hoqoqi -- --apply --resume");
  }
}

async function importSystems(model: ImportModel, articleCountBySystem: Map<string, number>, checkpoint: ImportCheckpoint) {
  for (let index = checkpoint.lastSystemIndex; index < model.systems.length; index += 1) {
    const system = model.systems[index];
    await withRetry(async () => {
      await prisma.legalSystem.upsert({
        where: { name: system.name },
        // على التحديث: لا نطمس التصنيف المُنسَّق القائم (نُحدّث العدد فقط) — «لا تكسر القائم» (§22).
        // التصنيف يُضبَط عند الإنشاء فقط (نظامٌ جديد لم يكن موجودًا).
        update: {
          articleCount: articleCountBySystem.get(system.sourceId) ?? 0
        },
        create: {
          name: system.name,
          classification: system.classification,
          articleCount: articleCountBySystem.get(system.sourceId) ?? 0
        }
      });
    });
    checkpoint.importedSystems += 1;
    checkpoint.lastSystemIndex = index + 1;
    checkpoint.lastUpdatedAt = new Date().toISOString();
    if (index % 25 === 0 || index === model.systems.length - 1) await saveCheckpoint(checkpoint);
  }
  await saveCheckpoint(checkpoint);
}

async function loadSystemIds(systems: HoqoqiSystem[]) {
  const names = systems.map((system) => system.name);
  const rows = await withRetry(() =>
    prisma.legalSystem.findMany({
      where: { name: { in: names } },
      select: { id: true, name: true }
    })
  );
  const idByName = new Map(rows.map((row) => [row.name, row.id]));
  return new Map(systems.map((system) => [system.sourceId, idByName.get(system.name)]).filter((entry): entry is [string, string] => Boolean(entry[1])));
}

async function importArticles(
  model: ImportModel,
  systemIdBySource: Map<string, string>,
  checkpoint: ImportCheckpoint,
  options: ImportOptions,
  startedAt: number
) {
  const totalBatches = Math.ceil(model.articles.length / options.batchSize);

  for (let start = checkpoint.lastArticleIndex; start < model.articles.length; start += options.batchSize) {
    const end = Math.min(start + options.batchSize, model.articles.length);
    const batch = model.articles.slice(start, end);
    const batchNumber = Math.floor(start / options.batchSize) + 1;
    const data = batch
      .map((article) => {
        const lawName = article.lawName ?? model.systems.find((system) => system.sourceId === article.sourceSystemId)?.name;
        const legalSystemId = systemIdBySource.get(article.sourceSystemId);
        // نقبل رقم المادة صفر (الديباجة) — الشرط «!articleNumber» كان يُسقطها؛ نستعمل الانتهاء لا الصدق.
        if (!lawName || !legalSystemId || !Number.isFinite(article.articleNumber) || !article.content) return null;
        return {
          legalSystemId,
          lawName,
          classification: article.classification,
          articleNumber: article.articleNumber as number,
          title: article.title ?? `المادة ${article.articleNumber}`,
          content: article.content,
          chapter: article.chapter,
          royalDecree: article.royalDecree,
          effectiveFrom: parseGregorianDate(article.effectiveFrom),
          status: "needs_review",
          keywords: article.keywords
        };
      })
      .filter((article): article is NonNullable<typeof article> => Boolean(article));

    try {
      const result = await withRetry(() =>
        prisma.legalArticle.createMany({
          data,
          skipDuplicates: true
        })
      );
      checkpoint.importedArticles += result.count;
      checkpoint.skippedArticles += Math.max(data.length - result.count, 0);
    } catch (error) {
      checkpoint.failedArticles += batch.length;
      checkpoint.failedArticleIds.push(...batch.map((article) => article.sourceId).slice(0, 50));
      checkpoint.lastUpdatedAt = new Date().toISOString();
      await saveCheckpoint(checkpoint);
      console.error("فشل استيراد دفعة بعد كل محاولات retry. تم حفظ checkpoint.");
      throw error;
    }

    checkpoint.lastArticleIndex = end;
    checkpoint.lastUpdatedAt = new Date().toISOString();
    await saveCheckpoint(checkpoint);
    printProgress(checkpoint, model.articles.length, batchNumber, totalBatches, startedAt);
  }
}

function printReport(inputPath: string, parsed: ParsedSql, model: ImportModel, apply: boolean) {
  const detectedTargetTables = targetTables.filter((table) => parsed.tables.has(table));
  console.log("تقرير فحص قاعدة حقوقي");
  console.log(JSON.stringify(
    {
      file: inputPath,
      mode: apply ? "apply" : "dry-run",
      detectedTables: detectedTargetTables,
      allCreateTables: parsed.tableNames.length,
      systemsDiscovered: model.systems.length,
      articlesConvertible: model.articles.length,
      // كشف الجلب: كم ديباجةً (مادّة رقم صفر) وكم أداة إصدار (مرسوم) التُقِطت من المصدر؟
      preamblesDiscovered: model.articles.filter((a) => a.articleNumber === PREAMBLE_ARTICLE_NUMBER).length,
      instrumentsDiscovered: model.systems.filter((s) => Boolean(s.royalDecree)).length,
      categoriesDiscovered: model.categories.size,
      nouns: model.nounsCount,
      verbs: model.verbsCount,
      invalidArticles: model.invalidArticles.length,
      duplicateArticleKeys: model.duplicateArticles.length,
      sourceTag: "hoqoqi_sql",
      reviewStatus: "needs_review"
    },
    null,
    2
  ));
}

function createCheckpoint(): ImportCheckpoint {
  const now = new Date().toISOString();
  return {
    startedAt: now,
    lastSystemIndex: 0,
    lastArticleIndex: 0,
    importedSystems: 0,
    importedArticles: 0,
    skippedArticles: 0,
    failedArticles: 0,
    failedArticleIds: [],
    completed: false,
    lastUpdatedAt: now
  };
}

async function loadCheckpoint() {
  if (!(await fileExists(checkpointPath))) return createCheckpoint();
  const raw = await fs.readFile(checkpointPath, "utf8");
  const parsed = JSON.parse(raw) as Partial<ImportCheckpoint>;
  return {
    ...createCheckpoint(),
    ...parsed,
    failedArticleIds: parsed.failedArticleIds ?? []
  };
}

async function saveCheckpoint(checkpoint: ImportCheckpoint) {
  await fs.writeFile(checkpointPath, JSON.stringify(checkpoint, null, 2), "utf8");
}

async function fileExists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function withRetry<T>(operation: () => Promise<T>, attempts = 5): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isTransientDatabaseError(error) || attempt === attempts) break;
      const delay = Math.min(30000, 1000 * 2 ** (attempt - 1));
      console.warn(`تعذر الاتصال بقاعدة البيانات. محاولة ${attempt}/${attempts}. إعادة المحاولة بعد ${delay}ms.`);
      await sleep(delay);
    }
  }
  throw lastError;
}

function isTransientDatabaseError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /P1001|Can't reach database server|timeout|timed out|connection reset|ECONNRESET|ETIMEDOUT|Connection terminated/i.test(message);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function countArticlesBySystem(articles: HoqoqiArticle[]) {
  const counts = new Map<string, number>();
  for (const article of articles) {
    // الديباجة (رقم صفر) ليست مادّةً موضوعيّة — لا تُحتسب في articleCount كي يبقى العدّ دقيقًا.
    if (article.articleNumber === PREAMBLE_ARTICLE_NUMBER) continue;
    counts.set(article.sourceSystemId, (counts.get(article.sourceSystemId) ?? 0) + 1);
  }
  return counts;
}

function printProgress(checkpoint: ImportCheckpoint, totalArticles: number, batchNumber: number, totalBatches: number, startedAt: number) {
  const elapsedMs = Date.now() - startedAt;
  const processed = Math.max(checkpoint.lastArticleIndex, 1);
  const remaining = Math.max(totalArticles - checkpoint.lastArticleIndex, 0);
  const estimatedRemainingMs = Math.round((elapsedMs / processed) * remaining);
  console.log(
    [
      `Imported articles: ${checkpoint.importedArticles} / ${totalArticles}`,
      `Batch: ${batchNumber} / ${totalBatches}`,
      `Skipped duplicates: ${checkpoint.skippedArticles}`,
      `Failed: ${checkpoint.failedArticles}`,
      `Elapsed: ${formatDuration(elapsedMs)}`,
      `Estimated remaining: ${formatDuration(estimatedRemainingMs)}`
    ].join(" | ")
  );
}

function formatDuration(ms: number) {
  const totalSeconds = Math.max(Math.round(ms / 1000), 0);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

function pick(row: SqlRow, keys: string[]) {
  const normalized = new Map(Object.entries(row).map(([key, value]) => [key.toLowerCase(), value]));
  for (const key of keys) {
    if (normalized.has(key.toLowerCase())) return normalized.get(key.toLowerCase());
  }
  return undefined;
}

function stringValue(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

/** يحوّل تاريخًا ميلاديًّا (مثل «1992-03-01») إلى Date؛ يعيد undefined لغير الصالح (لا اختلاق). */
function parseGregorianDate(value: string | undefined): Date | undefined {
  const s = (value ?? "").trim();
  if (!/^\d{4}-\d{1,2}-\d{1,2}/.test(s)) return undefined;
  const d = new Date(s.slice(0, 10));
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/** يُشغَّل main فقط عند الاستدعاء المباشر (لا عند الاستيراد للاختبار). */
function isDirectRun(): boolean {
  try {
    return Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}

if (isDirectRun()) {
  main()
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

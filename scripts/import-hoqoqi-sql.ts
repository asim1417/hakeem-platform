import { PrismaClient } from "@prisma/client";
import fs from "node:fs/promises";
import path from "node:path";
import zlib from "node:zlib";

const prisma = new PrismaClient();

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
  "tools_issuance_law",
  "amendment_articles_law",
  "nouns",
  "verbs"
];

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const inputPath = resolveInputPath(args);

  const sql = await readSqlFromZip(inputPath);
  const parsed = parseSqlInserts(sql);
  const model = buildImportModel(parsed);

  printReport(inputPath, parsed, model, apply);

  if (!apply) {
    console.log("وضع الفحص فقط. لم يتم إدخال أي بيانات. أعد التشغيل مع --apply عند التأكد من DATABASE_URL.");
    return;
  }

  await importModel(model);
}

function resolveInputPath(args: string[]) {
  const explicit = args.find((arg) => arg.startsWith("--file="))?.slice("--file=".length);
  const positional = args.find((arg) => !arg.startsWith("--"));
  return path.resolve(process.cwd(), explicit || positional || "hoqoqi.sql.zip");
}

async function readSqlFromZip(filePath: string) {
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

function parseSqlInserts(sql: string): ParsedSql {
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

function buildImportModel(parsed: ParsedSql): ImportModel {
  const categories = buildCategories(parsed);
  const systems = buildSystems(parsed, categories);
  const articles = buildArticles(parsed, systems, categories);
  const duplicateArticles = findDuplicateArticleKeys(articles);
  const invalidArticles = articles
    .filter((article) => !article.sourceSystemId || !article.content || !article.articleNumber)
    .map((article) => article.sourceId);

  return {
    systems,
    articles: articles.filter((article) => article.sourceSystemId && article.content && article.articleNumber),
    categories,
    nounsCount: (parsed.tables.get("nouns") ?? []).length,
    verbsCount: (parsed.tables.get("verbs") ?? []).length,
    invalidArticles,
    duplicateArticles
  };
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
    systems.set(sourceId, {
      sourceId,
      name: current?.name ?? "",
      classification: current?.classification ?? (categoryId ? categories.get(categoryId) : undefined),
      description: current?.description ?? description
    });
  }

  for (const row of langRows) {
    const sourceId = stringValue(pick(row, ["law_id", "id_law", "laws_id"]));
    const name = stringValue(pick(row, ["name", "title", "law_name", "lang_name", "ar_name"]));
    if (!sourceId || !name) continue;
    const current = systems.get(sourceId);
    systems.set(sourceId, {
      sourceId,
      name,
      classification: current?.classification,
      description: current?.description ?? stringValue(pick(row, ["law_preamble", "description", "summary", "details", "intro"]))
    });
  }

  return Array.from(systems.values()).filter((system) => system.name);
}

function buildArticles(parsed: ParsedSql, systems: HoqoqiSystem[], categories: Map<string, string>) {
  const systemNames = new Map(systems.map((system) => [system.sourceId, system.name]));
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
  return match ? Number(match[0]) : undefined;
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

async function importModel(model: ImportModel) {
  const systemIdBySource = new Map<string, string>();

  for (const system of model.systems) {
    const created = await prisma.legalSystem.upsert({
      where: { name: system.name },
      update: {
        classification: system.classification,
        articleCount: model.articles.filter((article) => article.sourceSystemId === system.sourceId).length
      },
      create: {
        name: system.name,
        classification: system.classification,
        articleCount: model.articles.filter((article) => article.sourceSystemId === system.sourceId).length
      }
    });
    systemIdBySource.set(system.sourceId, created.id);
  }

  let importedArticles = 0;
  for (const article of model.articles) {
    const lawName = article.lawName ?? model.systems.find((system) => system.sourceId === article.sourceSystemId)?.name;
    const legalSystemId = systemIdBySource.get(article.sourceSystemId);
    if (!lawName || !legalSystemId || !article.articleNumber) continue;

    await prisma.legalArticle.upsert({
      where: { lawName_articleNumber: { lawName, articleNumber: article.articleNumber } },
      update: {
        legalSystemId,
        classification: article.classification,
        title: article.title ?? `المادة ${article.articleNumber}`,
        content: article.content,
        chapter: article.chapter,
        status: "needs_review",
        keywords: article.keywords
      },
      create: {
        legalSystemId,
        lawName,
        classification: article.classification,
        articleNumber: article.articleNumber,
        title: article.title ?? `المادة ${article.articleNumber}`,
        content: article.content,
        chapter: article.chapter,
        status: "needs_review",
        keywords: article.keywords
      }
    });
    importedArticles += 1;
  }

  console.log(`تم تنفيذ الاستيراد/التحديث. الأنظمة: ${model.systems.length}. المواد: ${importedArticles}.`);
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

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

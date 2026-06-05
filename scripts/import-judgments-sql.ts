import { Prisma, PrismaClient } from "@prisma/client";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Writable } from "node:stream";
import zlib from "node:zlib";

const prisma = new PrismaClient();
const importCheckpointPath = path.join(process.cwd(), ".import-judgments-checkpoint.json");
const linkCheckpointPath = path.join(process.cwd(), ".link-judgments-checkpoint.json");
const importLockPath = path.join(process.cwd(), ".import-judgments.lock");
const linkLockPath = path.join(process.cwd(), ".link-judgments.lock");
const LOCK_STALE_MS = 15 * 60 * 1000; // قفل أقدم من ١٥ دقيقة يُعدّ ميتاً
let activeLockPath: string | null = null;

type SqlRow = Record<string, string | number | null>;

type ParsedInsertTable = {
  name: string;
  rows: SqlRow[];
};

type JudgmentImportRow = {
  sourceId: number | null;
  sourcePageId: number | null;
  decisionNo: string | null;
  caseNo: string | null;
  courtOfAppeal: string | null;
  cityOfAppeal: string | null;
  court: string | null;
  cityName: string | null;
  decisionDateText: string | null;
  caseDateText: string | null;
  decisionDate: Date | null;
  caseDate: Date | null;
  classification: Prisma.InputJsonObject | null;
  judgmentTitle: string | null;
  judgmentText: string;
  appealText: string | null;
  sourceLink: string | null;
  raw: SqlRow;
};

type ImportOptions = {
  apply: boolean;
  resume: boolean;
  resetCheckpoint: boolean;
  batchSize: number;
  inputPath: string;
  importOnly: boolean;
  linkOnly: boolean;
  forever: boolean;
  status: boolean;
};

type LinkCheckpoint = {
  startedAt: string;
  lastCaseId: string | null;
  casesScanned: number;
  citationsFound: number;
  linksCreated: number;
  needsReview: number;
  errors: number;
  completed: boolean;
  lastUpdatedAt: string;
};

type ImportCheckpoint = {
  startedAt: string;
  lastRowIndex: number;
  importedCases: number;
  skippedDuplicates: number;
  failedCases: number;
  importedLinks: number;
  unresolvedCitations: number;
  failedSourceIds: Array<number | string>;
  completed: boolean;
  lastUpdatedAt: string;
};

type LegalSystemCandidate = {
  id: string;
  name: string;
  normalizedName: string;
};

type ResolvedCitation = {
  articleId: string;
  relationType: string;
  citedText: string;
  excerpt: string;
  confidence: number;
};

async function main() {
  const options = await resolveOptions(process.argv.slice(2));

  // ===== وضع الحالة فقط =====
  if (options.status) {
    await printStatus(options);
    return;
  }

  // ===== المرحلة الثانية: الربط فقط (مستقل تماماً عن الاستيراد) =====
  if (options.linkOnly) {
    if (options.resetCheckpoint) {
      await fsp.rm(linkCheckpointPath, { force: true });
      console.log(`Deleted link checkpoint: ${linkCheckpointPath}`);
    }
    if (!options.apply) {
      console.log("Dry-run (link). No links were written. To link, run: npm run link:judgments");
      return;
    }
    await withLock(linkLockPath, async () => {
      if (options.forever) await runForever(() => linkJudgments(options), isLinkComplete);
      else await linkJudgments(options);
    });
    return;
  }

  // ===== المرحلة الأولى: الاستيراد (مع/بدون الربط حسب --import-only) =====
  if (options.resetCheckpoint) {
    await fsp.rm(importCheckpointPath, { force: true });
    console.log(`Deleted checkpoint: ${importCheckpointPath}`);
  }

  const sql = await readGzipSql(options.inputPath);
  const tables = parseInsertTables(sql);
  const judgments = extractJudgments(tables);

  printInspectionReport(options.inputPath, tables, judgments, options);

  if (!options.apply) {
    console.log("Dry-run only. No database writes were executed.");
    console.log("To import only (fast), run: npm run import:judgments -- --apply --import-only");
    console.log("To resume, run: npm run import:judgments:resume");
    console.log("To link afterwards, run: npm run link:judgments:resume");
    return;
  }

  await withLock(importLockPath, async () => {
    if (options.forever) await runForever(() => importJudgments(judgments, options), isImportComplete);
    else await importJudgments(judgments, options);
  });
}

async function resolveOptions(args: string[]): Promise<ImportOptions> {
  const resetCheckpoint = args.includes("--reset-checkpoint");
  const linkOnly = args.includes("--link-only");
  const activeCheckpoint = linkOnly ? linkCheckpointPath : importCheckpointPath;
  const checkpointExists = await fileExists(activeCheckpoint);
  return {
    apply: args.includes("--apply"),
    resume: args.includes("--resume") || (checkpointExists && !resetCheckpoint),
    resetCheckpoint,
    batchSize: readNumberOption(args, "--batch-size", 100),
    inputPath: resolveInputPath(args),
    importOnly: args.includes("--import-only"),
    linkOnly,
    forever: args.includes("--forever"),
    status: args.includes("--status")
  };
}

function resolveInputPath(args: string[]) {
  const explicit = args.find((arg) => arg.startsWith("--file="))?.slice("--file=".length);
  const positional = args.find((arg) => !arg.startsWith("--"));
  return path.resolve(process.cwd(), explicit || positional || "ahkam_moj.sql.gz");
}

function readNumberOption(args: string[], optionName: string, fallback: number) {
  const raw = args.find((arg) => arg.startsWith(`${optionName}=`))?.slice(optionName.length + 1);
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

async function readGzipSql(filePath: string) {
  if (!(await fileExists(filePath))) {
    throw new Error(`Judgments SQL file was not found: ${filePath}`);
  }

  const chunks: Buffer[] = [];
  await pipeline(
    fs.createReadStream(filePath),
    zlib.createGunzip(),
    new Writable({
      write(chunk, _encoding, callback) {
        chunks.push(Buffer.from(chunk));
        callback();
      }
    })
  );
  return Buffer.concat(chunks).toString("utf8");
}

function parseInsertTables(sql: string): ParsedInsertTable[] {
  const tables = new Map<string, SqlRow[]>();
  const insertPattern = /INSERT\s+INTO\s+`?([^`\s(]+)`?\s*\(([^)]+)\)\s*VALUES\s*/gi;
  let match: RegExpExecArray | null;

  while ((match = insertPattern.exec(sql))) {
    const tableName = match[1];
    const columns = match[2].split(",").map((column) => stripSqlIdentifier(column.trim()));
    const valuesStart = insertPattern.lastIndex;
    const statementEnd = findStatementEnd(sql, valuesStart);
    const valuesSql = sql.slice(valuesStart, statementEnd);
    insertPattern.lastIndex = statementEnd + 1;

    const rows = parseValuesRows(valuesSql).map((values) => rowFromValues(columns, values));
    const current = tables.get(tableName) ?? [];
    current.push(...rows);
    tables.set(tableName, current);
  }

  return Array.from(tables, ([name, rows]) => ({ name, rows }));
}

function stripSqlIdentifier(value: string) {
  return value.replace(/^`|`$/g, "").trim();
}

function findStatementEnd(sql: string, start: number) {
  let quote: "'" | '"' | null = null;
  let escaped = false;
  for (let index = start; index < sql.length; index += 1) {
    const char = sql[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = Boolean(quote);
      continue;
    }
    if ((char === "'" || char === "\"") && (!quote || quote === char)) {
      quote = quote ? null : char;
      continue;
    }
    if (!quote && char === ";") return index;
  }
  return sql.length;
}

function parseValuesRows(valuesSql: string) {
  const rows: Array<Array<string | number | null>> = [];
  let row: Array<string | number | null> | null = null;
  let token = "";
  let quote: "'" | '"' | null = null;
  let escaped = false;

  for (let index = 0; index < valuesSql.length; index += 1) {
    const char = valuesSql[index];
    if (escaped) {
      token += unescapeSqlChar(char);
      escaped = false;
      continue;
    }
    if (quote && char === "\\") {
      escaped = true;
      continue;
    }
    if ((char === "'" || char === "\"") && (!quote || quote === char)) {
      quote = quote ? null : char;
      continue;
    }
    if (!quote && char === "(") {
      row = [];
      token = "";
      continue;
    }
    if (!quote && row && (char === "," || char === ")")) {
      row.push(parseSqlValue(token));
      token = "";
      if (char === ")") {
        rows.push(row);
        row = null;
      }
      continue;
    }
    if (row) token += char;
  }

  return rows;
}

function parseSqlValue(value: string): string | number | null {
  const trimmed = value.trim();
  if (!trimmed || /^null$/i.test(trimmed)) return null;
  if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) return Number(trimmed);
  return trimmed.replace(/\\'/g, "'").replace(/\\"/g, "\"").replace(/\\n/g, "\n").replace(/\\r/g, "\r").replace(/\\\\/g, "\\");
}

function unescapeSqlChar(char: string) {
  if (char === "n") return "\n";
  if (char === "r") return "\r";
  if (char === "t") return "\t";
  return char;
}

function rowFromValues(columns: string[], values: Array<string | number | null>) {
  const row: SqlRow = {};
  columns.forEach((column, index) => {
    row[column] = values[index] ?? null;
  });
  return row;
}

function extractJudgments(tables: ParsedInsertTable[]) {
  const candidates = tables
    .map((table) => ({ table, score: scoreJudgmentTable(table) }))
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score);

  const source = candidates[0]?.table;
  if (!source) return [];

  return source.rows.map(mapJudgmentRow).filter((row): row is JudgmentImportRow => Boolean(row));
}

function scoreJudgmentTable(table: ParsedInsertTable) {
  const sample = table.rows[0] ?? {};
  const columns = Object.keys(sample).map((column) => column.toLowerCase());
  let score = 0;
  if (columns.some((column) => column.includes("judgment_text") || column === "judgment")) score += 5;
  if (columns.some((column) => column.includes("appeal_text"))) score += 2;
  if (columns.some((column) => column.includes("case_no") || column.includes("decision_no"))) score += 2;
  if (/ahkam|judg|case|moj/i.test(table.name)) score += 1;
  return score;
}

function mapJudgmentRow(raw: SqlRow): JudgmentImportRow | null {
  const judgmentText = pickString(raw, ["judgment_text", "judgment", "text", "body", "content"]);
  if (!judgmentText || judgmentText.trim().length < 20) return null;

  const classification = buildClassification(raw);
  const decisionDateText = pickString(raw, ["decision_date", "decision_date_hijri", "decisionDate", "date"]);
  const caseDateText = pickString(raw, ["case_date", "case_date_hijri", "caseDate"]);

  return {
    sourceId: pickNumber(raw, ["id", "source_id", "judgment_id"]),
    sourcePageId: pickNumber(raw, ["page_id", "source_page_id", "sourcePageId"]),
    decisionNo: pickString(raw, ["decision_no", "decision_number", "decisionNo"]),
    caseNo: pickString(raw, ["case_no", "case_number", "caseNo"]),
    courtOfAppeal: pickString(raw, ["court_of_appeal", "appeal_court", "courtOfAppeal"]),
    cityOfAppeal: pickString(raw, ["city_of_appeal", "appeal_city", "cityOfAppeal"]),
    court: pickString(raw, ["court", "court_name", "courtName"]),
    cityName: pickString(raw, ["city_name", "city", "cityName"]),
    decisionDateText,
    caseDateText,
    decisionDate: parseDateCandidate(decisionDateText),
    caseDate: parseDateCandidate(caseDateText),
    classification,
    judgmentTitle: pickString(raw, ["judgment_title", "title", "name"]),
    judgmentText: judgmentText.trim(),
    appealText: pickString(raw, ["appeal_text", "appeal", "appealText"]),
    sourceLink: pickString(raw, ["source_link", "link", "url"]),
    raw
  };
}

function pickString(row: SqlRow, names: string[]) {
  for (const name of names) {
    const value = row[name] ?? row[name.toLowerCase()] ?? row[toCamelCase(name)];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return null;
}

function pickNumber(row: SqlRow, names: string[]) {
  const value = pickString(row, names);
  if (!value) return null;
  const numeric = Number(value.replace(/[^\d-]/g, ""));
  return Number.isFinite(numeric) ? numeric : null;
}

function toCamelCase(value: string) {
  return value.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

function buildClassification(row: SqlRow): Prisma.InputJsonObject | null {
  const fields = ["classification", "case_type", "case_classification", "category", "topic"];
  const values = Object.fromEntries(fields.map((field) => [field, pickString(row, [field])]).filter(([, value]) => value));
  return Object.keys(values).length ? values : null;
}

function parseDateCandidate(value: string | null) {
  if (!value) return null;
  const cleaned = value.replace(/[^\d/-]/g, "");
  const parts = cleaned.split(/[/-]/).map(Number).filter(Boolean);
  if (parts.length < 3) return null;
  const [year, month, day] = parts;
  if (year < 1700 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return new Date(Date.UTC(year, month - 1, day));
}

async function importJudgments(rows: JudgmentImportRow[], options: ImportOptions) {
  const startedAt = new Date();
  const checkpoint = options.resume ? await readImportCheckpoint() : null;
  const state: ImportCheckpoint =
    checkpoint && !checkpoint.completed
      ? checkpoint
      : {
          startedAt: startedAt.toISOString(),
          lastRowIndex: 0,
          importedCases: 0,
          skippedDuplicates: 0,
          failedCases: 0,
          importedLinks: 0,
          unresolvedCitations: 0,
          failedSourceIds: [],
          completed: false,
          lastUpdatedAt: startedAt.toISOString()
        };

  // عند --import-only لا نحمّل الأنظمة ولا نستخرج الاستشهادات (أسرع وأخف ذاكرة)
  const systemCandidates = options.importOnly
    ? []
    : (await prisma.legalSystem.findMany({ select: { id: true, name: true } })).map((system) => ({ ...system, normalizedName: normalizeArabic(system.name) }));
  const batches = Math.ceil(rows.length / options.batchSize);

  for (let start = state.lastRowIndex; start < rows.length; start += options.batchSize) {
    const batch = rows.slice(start, start + options.batchSize);
    const batchNumber = Math.floor(start / options.batchSize) + 1;

    await withRetry(async () => {
      for (let offset = 0; offset < batch.length; offset += 1) {
        const rowIndex = start + offset;
        const row = batch[offset];
        try {
          const existing = await findExistingJudicialCase(row);
          if (existing) {
            state.skippedDuplicates += 1;
            state.lastRowIndex = rowIndex + 1;
            continue;
          }

          const created = await prisma.judicialCase.create({
            data: {
              sourceId: row.sourceId,
              sourcePageId: row.sourcePageId,
              decisionNo: row.decisionNo,
              caseNo: row.caseNo,
              courtOfAppeal: row.courtOfAppeal,
              cityOfAppeal: row.cityOfAppeal,
              court: row.court,
              cityName: row.cityName,
              decisionDateText: row.decisionDateText,
              caseDateText: row.caseDateText,
              decisionDate: row.decisionDate,
              caseDate: row.caseDate,
              classification: row.classification ?? undefined,
              judgmentTitle: row.judgmentTitle,
              judgmentText: row.judgmentText,
              appealText: row.appealText,
              sourceLink: row.sourceLink
            }
          });

          // الربط أثناء الاستيراد يحدث فقط في الوضع المدمج (بدون --import-only)
          if (!options.importOnly) {
            const citations = await resolveJudgmentCitations(row.judgmentText, systemCandidates);
            const now = new Date();
            if (citations.length) {
              await prisma.legalArticleCaseLink.createMany({
                data: citations.map((citation) => ({
                  articleId: citation.articleId,
                  caseId: created.id,
                  relationType: citation.relationType,
                  citedText: citation.citedText,
                  excerpt: citation.excerpt,
                  explanation: "تم ربط الاستشهاد آليًا من نص الحكم ويحتاج مراجعة قانونية.",
                  confidence: citation.confidence,
                  reviewStatus: "needs_review",
                  createdAt: now,
                  updatedAt: now
                })),
                skipDuplicates: true
              });
              state.importedLinks += citations.length;
            } else {
              state.unresolvedCitations += 1;
            }
          }

          state.importedCases += 1;
          state.lastRowIndex = rowIndex + 1;
        } catch (error) {
          state.failedCases += 1;
          state.failedSourceIds.push(row.sourceId ?? row.caseNo ?? rowIndex);
          state.lastRowIndex = rowIndex + 1;
          console.error(`Failed judgment row ${rowIndex + 1}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    });

    state.lastUpdatedAt = new Date().toISOString();
    await writeImportCheckpoint(state);
    printProgress(state, rows.length, batchNumber, batches, startedAt, options);
  }

  state.completed = true;
  state.lastUpdatedAt = new Date().toISOString();
  await writeImportCheckpoint(state);
  printFinalReport(state, rows.length, startedAt, options);
}

async function findExistingJudicialCase(row: JudgmentImportRow) {
  const or: Array<Record<string, unknown>> = [];
  if (row.sourceId) or.push({ sourceId: row.sourceId });
  if (row.sourceLink) or.push({ sourceLink: row.sourceLink });
  if (row.caseNo && row.judgmentTitle) or.push({ AND: [{ caseNo: row.caseNo }, { judgmentTitle: row.judgmentTitle }] });
  if (row.caseNo && row.decisionNo) or.push({ AND: [{ caseNo: row.caseNo }, { decisionNo: row.decisionNo }] });
  if (!or.length) return null;
  return prisma.judicialCase.findFirst({ where: { OR: or }, select: { id: true } });
}

async function resolveJudgmentCitations(text: string, systems: LegalSystemCandidate[]) {
  const mentions = extractArticleMentions(text, systems);
  const links: ResolvedCitation[] = [];
  const seen = new Set<string>();

  for (const mention of mentions) {
    const article = await prisma.legalArticle.findFirst({
      where: {
        articleNumber: mention.articleNumber,
        OR: mention.systemName
          ? [{ lawName: { contains: mention.systemName, mode: "insensitive" } }, { legalSystem: { name: { contains: mention.systemName, mode: "insensitive" } } }]
          : undefined
      },
      select: { id: true }
    });
    if (!article) continue;
    const key = `${article.id}:${mention.rawText}`;
    if (seen.has(key)) continue;
    seen.add(key);
    links.push({
      articleId: article.id,
      relationType: classifyRelation(mention.context),
      citedText: mention.rawText,
      excerpt: mention.context,
      confidence: mention.systemName ? 0.88 : 0.68
    });
  }

  return links;
}

function extractArticleMentions(text: string, systems: LegalSystemCandidate[]) {
  const mentions: Array<{ rawText: string; articleNumber: number; systemName: string | null; context: string }> = [];
  const pattern = /(?:المادة|مادة|المواد)\s*(?:رقم)?\s*[\(\[]?\s*([0-9٠-٩]+)\s*[\)\]]?/g;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    const articleNumber = Number(normalizeDigits(match[1]));
    if (!Number.isFinite(articleNumber)) continue;
    const context = sliceAround(text, index, 360);
    mentions.push({
      rawText: match[0],
      articleNumber,
      systemName: findSystemName(context, systems),
      context
    });
  }
  return mentions;
}

function findSystemName(context: string, systems: LegalSystemCandidate[]) {
  const normalized = normalizeArabic(context);
  let best: LegalSystemCandidate | null = null;
  for (const system of systems) {
    if (!system.normalizedName || !normalized.includes(system.normalizedName)) continue;
    if (!best || system.normalizedName.length > best.normalizedName.length) best = system;
  }
  return best?.name ?? null;
}

function classifyRelation(context: string) {
  if (/وحيث|لما كان|تقرر|حكمت|استنادا|استنادًا|تقضي/.test(context)) return "applied";
  if (/إجراء|اختصاص|قبول|تبليغ|إثبات|بينة/.test(context)) return "procedural_reference";
  if (/دفع|يدعي|طلب|أقوال|تمسك/.test(context)) return "cited";
  return "supporting_authority";
}

function normalizeArabic(text: string) {
  return text
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeDigits(value: string) {
  return value.replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
}

function sliceAround(text: string, index: number, radius: number) {
  return text.slice(Math.max(0, index - radius), Math.min(text.length, index + radius));
}

async function withRetry<T>(operation: () => Promise<T>, attempts = 5): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isTransientDatabaseError(error) || attempt === attempts) break;
      const delay = 800 * 2 ** (attempt - 1);
      console.warn(`Transient database error. Retrying in ${delay}ms (${attempt}/${attempts})...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

function isTransientDatabaseError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /P1001|Can't reach database server|timeout|ETIMEDOUT|ECONNRESET|connection.*closed|server.*closed|Connection terminated/i.test(message);
}

async function readImportCheckpoint() {
  if (!(await fileExists(importCheckpointPath))) return null;
  const text = await fsp.readFile(importCheckpointPath, "utf8");
  return JSON.parse(text) as ImportCheckpoint;
}

async function writeImportCheckpoint(state: ImportCheckpoint) {
  await fsp.writeFile(importCheckpointPath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  await touchLock();
}

async function readLinkCheckpoint() {
  if (!(await fileExists(linkCheckpointPath))) return null;
  const text = await fsp.readFile(linkCheckpointPath, "utf8");
  return JSON.parse(text) as LinkCheckpoint;
}

async function writeLinkCheckpoint(state: LinkCheckpoint) {
  await fsp.writeFile(linkCheckpointPath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  await touchLock();
}

async function isImportComplete() {
  return (await readImportCheckpoint())?.completed === true;
}

async function isLinkComplete() {
  return (await readLinkCheckpoint())?.completed === true;
}

async function fileExists(filePath: string) {
  return fsp.access(filePath).then(() => true).catch(() => false);
}

// ===== أقفال التشغيل (منع تشغيل عمليتين متزامنتين على نفس المرحلة) =====
async function withLock<T>(lockPath: string, operation: () => Promise<T>): Promise<T> {
  if (await fileExists(lockPath)) {
    const stat = await fsp.stat(lockPath).catch(() => null);
    const age = stat ? Date.now() - stat.mtimeMs : Infinity;
    if (age < LOCK_STALE_MS) {
      const info = await fsp.readFile(lockPath, "utf8").catch(() => "");
      throw new Error(`عملية أخرى تعمل بالفعل (${path.basename(lockPath)}). ${info}\nإن كانت متوقفة فاحذف الملف: ${lockPath}`);
    }
    console.warn(`Stale lock detected (>${Math.round(LOCK_STALE_MS / 60000)}m). Overriding: ${lockPath}`);
  }
  await fsp.writeFile(lockPath, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }), "utf8");
  activeLockPath = lockPath;
  try {
    return await operation();
  } finally {
    activeLockPath = null;
    await fsp.rm(lockPath, { force: true });
  }
}

async function touchLock() {
  if (!activeLockPath) return;
  const now = new Date();
  await fsp.utimes(activeLockPath, now, now).catch(() => {});
}

// ===== التكرار التلقائي حتى الاكتمال (forever) =====
async function runForever(operation: () => Promise<void>, isComplete: () => Promise<boolean>) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      await operation();
    } catch (error) {
      console.error(`Run failed (attempt ${attempt}): ${error instanceof Error ? error.message : String(error)}`);
    }
    if (await isComplete()) {
      console.log("اكتملت العملية بالكامل — إيقاف الوضع المستمر.");
      break;
    }
    const delay = 5000;
    console.log(`Restarting in ${delay}ms (resume)…`);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}

// ===== المرحلة الثانية: ربط الأحكام بالمواد (مستقل عن الاستيراد) =====
async function linkJudgments(options: ImportOptions) {
  const startedAt = new Date();
  const checkpoint = options.resume ? await readLinkCheckpoint() : null;
  const state: LinkCheckpoint =
    checkpoint && !checkpoint.completed
      ? checkpoint
      : {
          startedAt: startedAt.toISOString(),
          lastCaseId: null,
          casesScanned: 0,
          citationsFound: 0,
          linksCreated: 0,
          needsReview: 0,
          errors: 0,
          completed: false,
          lastUpdatedAt: startedAt.toISOString()
        };

  const systems = await prisma.legalSystem.findMany({ select: { id: true, name: true } });
  const systemCandidates = systems.map((system) => ({ ...system, normalizedName: normalizeArabic(system.name) }));
  const total = await prisma.judicialCase.count();
  console.log(`Linking phase — judicial cases in database: ${total}`);

  while (true) {
    const cases: Array<{ id: string; judgmentText: string | null }> = await prisma.judicialCase.findMany({
      select: { id: true, judgmentText: true },
      orderBy: { id: "asc" },
      ...(state.lastCaseId ? { cursor: { id: state.lastCaseId }, skip: 1 } : {}),
      take: options.batchSize
    });
    if (!cases.length) break;

    await withRetry(async () => {
      for (const judicialCase of cases) {
        try {
          const citations = await resolveJudgmentCitations(judicialCase.judgmentText ?? "", systemCandidates);
          if (citations.length) {
            const now = new Date();
            const result = await prisma.legalArticleCaseLink.createMany({
              data: citations.map((citation) => ({
                articleId: citation.articleId,
                caseId: judicialCase.id,
                relationType: citation.relationType,
                citedText: citation.citedText,
                excerpt: citation.excerpt,
                explanation: "تم ربط الاستشهاد آليًا من نص الحكم ويحتاج مراجعة قانونية.",
                confidence: citation.confidence,
                reviewStatus: "needs_review",
                createdAt: now,
                updatedAt: now
              })),
              skipDuplicates: true
            });
            state.citationsFound += citations.length;
            state.linksCreated += result.count;
            state.needsReview += result.count;
          }
          state.casesScanned += 1;
          state.lastCaseId = judicialCase.id;
        } catch (error) {
          state.errors += 1;
          state.lastCaseId = judicialCase.id;
          console.error(`Failed linking case ${judicialCase.id}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    });

    state.lastUpdatedAt = new Date().toISOString();
    await writeLinkCheckpoint(state);
    printLinkProgress(state, total, startedAt);
  }

  state.completed = true;
  state.lastUpdatedAt = new Date().toISOString();
  await writeLinkCheckpoint(state);
  printLinkFinal(state, total, startedAt);
}

async function printStatus(options: ImportOptions) {
  if (options.linkOnly) {
    const cp = await readLinkCheckpoint();
    const total = await prisma.judicialCase.count().catch(() => null);
    console.log("Link checkpoint status");
    console.log(`Checkpoint: ${linkCheckpointPath}`);
    if (!cp) { console.log("No link checkpoint yet."); return; }
    console.log(`Cases scanned: ${cp.casesScanned}${total != null ? ` / ${total}` : ""}`);
    console.log(`Citations found: ${cp.citationsFound}`);
    console.log(`Links created: ${cp.linksCreated}`);
    console.log(`Needs review: ${cp.needsReview}`);
    console.log(`Errors: ${cp.errors}`);
    console.log(`Completed: ${cp.completed ? "yes" : "no"}`);
    console.log(`Last updated: ${cp.lastUpdatedAt}`);
    return;
  }
  const cp = await readImportCheckpoint();
  console.log("Import checkpoint status");
  console.log(`Checkpoint: ${importCheckpointPath}`);
  if (!cp) { console.log("No import checkpoint yet."); return; }
  console.log(`Imported cases: ${cp.importedCases}`);
  console.log(`Skipped duplicates: ${cp.skippedDuplicates}`);
  console.log(`Failed: ${cp.failedCases}`);
  console.log(`Last row index: ${cp.lastRowIndex}`);
  console.log(`Completed: ${cp.completed ? "yes" : "no"}`);
  console.log(`Last updated: ${cp.lastUpdatedAt}`);
}

function printInspectionReport(inputPath: string, tables: ParsedInsertTable[], judgments: JudgmentImportRow[], options: ImportOptions) {
  const tableRows = tables.map((table) => `${table.name}: ${table.rows.length}`).join(", ");
  console.log("Judgments SQL inspection");
  console.log(`File: ${inputPath}`);
  console.log(`Mode: ${options.apply ? "apply" : "dry-run"}`);
  console.log(`Batch size: ${options.batchSize}`);
  console.log(`Resume: ${options.resume ? "yes" : "no"}`);
  console.log(`Detected INSERT tables: ${tables.length}`);
  console.log(`Rows by table: ${tableRows || "none"}`);
  console.log(`Convertible judgments: ${judgments.length}`);
  console.log(`Invalid or empty judgment rows: ${Math.max(0, tables.reduce((sum, table) => sum + table.rows.length, 0) - judgments.length)}`);
}

function printProgress(state: ImportCheckpoint, totalRows: number, batchNumber: number, batches: number, startedAt: Date, options: ImportOptions) {
  const elapsedSeconds = Math.max((Date.now() - startedAt.getTime()) / 1000, 1);
  const rate = state.lastRowIndex / elapsedSeconds;
  const remaining = rate > 0 ? Math.ceil((totalRows - state.lastRowIndex) / rate) : 0;
  const pct = totalRows ? ((state.lastRowIndex / totalRows) * 100).toFixed(1) : "0";
  console.log([
    `${options.importOnly ? "[import-only]" : "[import+link]"}`,
    `Imported: ${state.importedCases} / ${totalRows} (${pct}%)`,
    `Batch: ${batchNumber} / ${batches}`,
    `Duplicates: ${state.skippedDuplicates}`,
    ...(options.importOnly ? [] : [`Links: ${state.importedLinks}`]),
    `Failed: ${state.failedCases}`,
    `Last sourceId index: ${state.lastRowIndex}`,
    `ETA: ${remaining}s`
  ].join(" | "));
}

function printFinalReport(state: ImportCheckpoint, totalRows: number, startedAt: Date, options: ImportOptions) {
  console.log(options.importOnly ? "Judgments import (import-only) completed" : "Judgments import completed");
  console.log(`Discovered judgments: ${totalRows}`);
  console.log(`Imported judgments: ${state.importedCases}`);
  console.log(`Skipped duplicates: ${state.skippedDuplicates}`);
  if (!options.importOnly) {
    console.log(`Imported article links: ${state.importedLinks}`);
    console.log(`Unresolved citation rows: ${state.unresolvedCitations}`);
  }
  console.log(`Failed rows: ${state.failedCases}`);
  console.log(`Progress: ${totalRows ? ((state.importedCases + state.skippedDuplicates) / totalRows * 100).toFixed(1) : "0"}%`);
  console.log(`Checkpoint: ${importCheckpointPath}`);
  console.log(`Elapsed seconds: ${Math.round((Date.now() - startedAt.getTime()) / 1000)}`);
  if (options.importOnly) console.log("Next: run linking with → npm run link:judgments:resume");
}

function printLinkProgress(state: LinkCheckpoint, total: number, startedAt: Date) {
  const elapsedSeconds = Math.max((Date.now() - startedAt.getTime()) / 1000, 1);
  const rate = state.casesScanned / elapsedSeconds;
  const remaining = rate > 0 ? Math.ceil((total - state.casesScanned) / rate) : 0;
  const pct = total ? ((state.casesScanned / total) * 100).toFixed(1) : "0";
  console.log([
    `[link-only]`,
    `Scanned: ${state.casesScanned} / ${total} (${pct}%)`,
    `Citations: ${state.citationsFound}`,
    `Links created: ${state.linksCreated}`,
    `Needs review: ${state.needsReview}`,
    `Errors: ${state.errors}`,
    `ETA: ${remaining}s`
  ].join(" | "));
}

function printLinkFinal(state: LinkCheckpoint, total: number, startedAt: Date) {
  console.log("Judgments linking completed");
  console.log(`Cases scanned: ${state.casesScanned} / ${total}`);
  console.log(`Citations detected: ${state.citationsFound}`);
  console.log(`Links created: ${state.linksCreated}`);
  console.log(`Needs review: ${state.needsReview}`);
  console.log(`Errors: ${state.errors}`);
  console.log(`Checkpoint: ${linkCheckpointPath}`);
  console.log(`Elapsed seconds: ${Math.round((Date.now() - startedAt.getTime()) / 1000)}`);
}

main()
  .catch(async (error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Writable } from "node:stream";
import zlib from "node:zlib";

async function main() {
  const inputPath = path.resolve(process.cwd(), process.argv.find((arg) => !arg.startsWith("--")) ?? "ahkam_moj.sql.gz");
  if (!(await exists(inputPath))) {
    throw new Error(`Judgments SQL file was not found: ${inputPath}`);
  }

  const sql = await readGzipSql(inputPath);
  const insertStatements = [...sql.matchAll(/INSERT\s+INTO\s+`?([^`\s(]+)`?\s*\(([^)]+)\)\s*VALUES/gi)];
  const tableStats = new Map<string, { statements: number; columns: string[]; estimatedRows: number }>();

  for (const match of insertStatements) {
    const table = match[1];
    const columns = match[2].split(",").map((column) => column.replace(/[`"']/g, "").trim());
    const current = tableStats.get(table) ?? { statements: 0, columns, estimatedRows: 0 };
    current.statements += 1;
    current.columns = Array.from(new Set([...current.columns, ...columns]));
    current.estimatedRows += estimateRows(sql, match.index ?? 0);
    tableStats.set(table, current);
  }

  console.log("Judgments SQL inspection report");
  console.log(`File: ${inputPath}`);
  console.log(`Size: ${(await fsp.stat(inputPath)).size.toLocaleString("en-US")} bytes`);
  console.log(`INSERT tables: ${tableStats.size}`);
  for (const [table, stat] of tableStats) {
    console.log(`- ${table}: statements=${stat.statements}, estimatedRows=${stat.estimatedRows}, columns=${stat.columns.slice(0, 20).join(", ")}`);
  }
}

async function readGzipSql(inputPath: string) {
  const chunks: Buffer[] = [];
  await pipeline(
    fs.createReadStream(inputPath),
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

function estimateRows(sql: string, start: number) {
  const end = sql.indexOf(";", start);
  const statement = sql.slice(start, end >= 0 ? end : start + 1);
  return Math.max((statement.match(/\),\s*\(/g) ?? []).length + 1, 1);
}

async function exists(filePath: string) {
  return fsp.access(filePath).then(() => true).catch(() => false);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

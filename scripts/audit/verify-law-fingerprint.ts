/**
 * HKM-028: يقارن مواد كل نظام في data/law-fingerprints/*.json بقاعدة البيانات، بقراءة فقط.
 * يطبع أعدادًا وأرقام مواد فقط (لا نصوص). يخرج بـ 1 عند أي اختلاف.
 *   npx tsx scripts/audit/verify-law-fingerprint.ts [ملف.json ...]
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { compareFingerprint, fingerprintClean, type LawFingerprint } from "../../lib/modules/legal-core/law-fingerprint";

const DIR = path.join(process.cwd(), "data/law-fingerprints");
const files = process.argv.slice(2).length
  ? process.argv.slice(2)
  : readdirSync(DIR).filter((f) => f.endsWith(".json")).map((f) => path.join(DIR, f));

const list = (xs: number[]) => (xs.length ? `${xs.length} (${xs.slice(0, 20).join("، ")}${xs.length > 20 ? "…" : ""})` : "0");

async function main() {
  const prisma = new PrismaClient();
  let bad = 0;
  try {
    for (const file of files) {
      const fp = JSON.parse(readFileSync(file, "utf8")) as LawFingerprint;
      const rows = await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
        return tx.$queryRawUnsafe<Array<{ articleNumber: number; title: string; content: string }>>(
          `SELECT "articleNumber", title, content FROM legal_articles WHERE "lawName" = $1`,
          fp.lawName,
        );
      });
      const d = compareFingerprint(fp.articles, rows);
      const clean = fingerprintClean(d);
      if (!clean) bad++;
      console.log(`${clean ? "✓" : "✗"} ${fp.lawName} — المتوقع ${d.expected} | الموجود ${d.actual}`);
      if (!clean) {
        console.log(`  ناقصة: ${list(d.missing)} | زائدة: ${list(d.extra)} | مكررة: ${list(d.duplicateNumbers)}`);
        console.log(`  عنوان مختلف: ${list(d.titleMismatch)} | نص مختلف: ${list(d.textMismatch)}`);
      }
    }
  } finally {
    await prisma.$disconnect();
  }
  console.log(bad ? `✗ ${bad} نظام لا يطابق بصمته` : `✓ ${files.length} نظام يطابق بصمته`);
  process.exit(bad ? 1 : 0);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : "failed");
  process.exit(2);
});

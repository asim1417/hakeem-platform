/**
 * inspect-vercel-db.ts — فحص قراءة-فقط لقاعدة بيانات الموقع الحيّ (Vercel).
 * يتّصل حصراً عبر VERCEL_DATABASE_URL_INSPECT (سرّ مستقل)، ولا يلمس DATABASE_URL الرئيسي.
 * SELECT count فقط — لا insert/update/delete/upsert/truncate، ولا seed/backfill.
 *
 * التشغيل: VERCEL_DATABASE_URL_INSPECT=... npx tsx scripts/inspect-vercel-db.ts
 */
import { PrismaClient } from "@prisma/client";

const url = process.env.VERCEL_DATABASE_URL_INSPECT;
if (!url) {
  console.error("✗ VERCEL_DATABASE_URL_INSPECT غير مضبوط. أوقفت (لن أستعمل DATABASE_URL الرئيسي).");
  process.exit(1);
}

// عميل معزول موجّه لرابط الفحص فقط — مستقل تماماً عن @/lib/prisma والـ DATABASE_URL الرئيسي.
const prisma = new PrismaClient({ datasourceUrl: url });

const TABLES = [
  "legal_systems",
  "legal_articles",
  "judicial_cases",
  "legal_article_case_links",
  "judicial_principles",
  "legal_relations",
  "embeddings",
  "users",
];

async function countTable(table: string): Promise<number | string> {
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ c: bigint }>>(`SELECT count(*)::bigint AS c FROM "${table}"`);
    return Number(rows[0]?.c ?? 0);
  } catch (e) {
    return `n/a (${e instanceof Error ? e.message.split("\n")[0].slice(0, 80) : "خطأ"})`;
  }
}

async function main() {
  console.log("🔎 فحص قاعدة الموقع الحيّ (Vercel) — قراءة فقط");
  console.log("=".repeat(56));

  // 1) سرد جداول public لكشف أي بنية مختلفة/قاعدة كبرى
  try {
    const tbls = await prisma.$queryRawUnsafe<Array<{ table_schema: string; table_name: string }>>(
      `SELECT table_schema, table_name FROM information_schema.tables
       WHERE table_schema NOT IN ('pg_catalog','information_schema')
       ORDER BY table_schema, table_name`
    );
    const pub = tbls.filter((t) => t.table_schema === "public");
    console.log(`📋 جداول public: ${pub.length} (إجمالي عبر المخططات: ${tbls.length})`);
    for (const t of pub) console.log(`  • public.${t.table_name}`);
  } catch (e) {
    console.log("تعذّر سرد الجداول:", e instanceof Error ? e.message.split("\n")[0] : e);
  }

  // 2) أعداد الجداول المستهدفة
  console.log("\n📊 الأعداد (SELECT count فقط):");
  const counts: Record<string, number | string> = {};
  for (const t of TABLES) {
    counts[t] = await countTable(t);
    console.log(`  ${t} = ${counts[t]}`);
  }

  // 3) تغطية embedding على legal_articles
  let embedded: number | string = "n/a";
  try {
    const r = await prisma.$queryRawUnsafe<Array<{ c: bigint }>>(
      `SELECT count(*)::bigint AS c FROM "legal_articles" WHERE "embedding" IS NOT NULL`
    );
    embedded = Number(r[0]?.c ?? 0);
  } catch {
    embedded = "n/a (تعذّر)";
  }
  console.log(`  legal_articles_with_embedding = ${embedded}`);

  // 4) ملخّص JSON
  console.log("\n" + "=".repeat(56));
  console.log(
    JSON.stringify(
      {
        inspectedDatabase: "Vercel live database (via VERCEL_DATABASE_URL_INSPECT)",
        legalSystems: counts["legal_systems"],
        legalArticles: counts["legal_articles"],
        judicialCases: counts["judicial_cases"],
        articleCaseLinks: counts["legal_article_case_links"],
        judicialPrinciples: counts["judicial_principles"],
        legalRelations: counts["legal_relations"],
        embeddingsTableRows: counts["embeddings"],
        users: counts["users"],
        legalArticleEmbeddings: embedded,
      },
      null,
      2
    )
  );
}

main()
  .catch((e) => {
    console.error("✗ خطأ في الفحص:", e instanceof Error ? e.message.split("\n")[0] : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect().catch(() => undefined));

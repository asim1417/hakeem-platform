/**
 * audit-db-environments.ts — تدقيق بيئات قواعد البيانات (قراءة فقط).
 * يفحص كل رابط يُمرَّر عبر متغيّر بيئة مخصّص، ويُخرج بصمة آمنة + أعداد جداول حكيم،
 * دون طباعة أي سرّ/كلمة مرور/رابط كامل، ودون أي كتابة (SELECT فقط).
 * لا يفشل عند غياب متغيّر — يسجّل "no connection configured".
 *
 * التشغيل: npm run audit:db-env
 */
import { PrismaClient } from "@prisma/client";

type Fingerprint = {
  provider: string;
  host: string;
  projectRef: string | null;
  region: string | null;
  dbName: string | null;
};

// متغيّرات الاتصال المدعومة (postgres + mysql).
const PG_VARS = ["DATABASE_URL", "VERCEL_DATABASE_URL_INSPECT", "GITHUB_DATABASE_URL_INSPECT"];
const MYSQL_VARS = ["HOSTINGER_DB_URL", "MYSQL_URL"];

const PG_TABLES: Record<string, string> = {
  legalSystems: "legal_systems",
  legalArticles: "legal_articles",
  judicialCases: "judicial_cases",
  judicialPrinciples: "judicial_principles",
  legalArticleCaseLinks: "legal_article_case_links",
  legalRelations: "legal_relations",
  embeddings: "embeddings",
  users: "users",
  cases: "cases",
  consultations: "consultations",
  simulationSessions: "simulation_sessions",
  simulationJudgments: "simulation_judgments",
  attachments: "attachments",
};

/** بصمة آمنة: host + projectRef + region + dbName فقط — بلا user كامل/password/رابط كامل. */
function fingerprint(raw: string): Fingerprint {
  try {
    const u = new URL(raw);
    const host = u.hostname;
    const dbName = u.pathname.replace(/^\//, "") || null;
    const proto = u.protocol.replace(":", "");
    let provider = proto.startsWith("mysql") ? "mysql" : "postgres";
    if (host.includes("supabase")) provider = host.includes("pooler") ? "supabase(pooler)" : "supabase";
    let projectRef: string | null = null;
    let region: string | null = null;
    const direct = host.match(/^db\.([a-z0-9]+)\.supabase\.co$/i);
    if (direct) projectRef = direct[1];
    const poolUser = (u.username || "").match(/^postgres\.([a-z0-9]+)$/i);
    if (poolUser) projectRef = poolUser[1];
    const reg = host.match(/aws-[0-9]+-([a-z0-9-]+)\.pooler\.supabase\.com/i);
    if (reg) region = reg[1];
    return { provider, host, projectRef, region, dbName };
  } catch {
    return { provider: "unknown", host: "unparseable", projectRef: null, region: null, dbName: null };
  }
}

async function auditPostgres(label: string, url: string) {
  const fp = fingerprint(url);
  const prisma = new PrismaClient({ datasourceUrl: url });
  const result: Record<string, unknown> = { label, databaseType: "postgres", safeHostFingerprint: fp };
  try {
    const tbls = await prisma.$queryRawUnsafe<Array<{ table_name: string }>>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`
    );
    const names = tbls.map((t) => t.table_name);
    result.connectionWorks = true;
    result.schemaDetected = "public";
    result.tablesCount = names.length;
    result.hasHakeemSchema = names.includes("legal_articles");

    const counts: Record<string, number | string> = {};
    for (const [key, table] of Object.entries(PG_TABLES)) {
      if (!names.includes(table)) {
        counts[key] = "tableMissing";
        continue;
      }
      try {
        const r = await prisma.$queryRawUnsafe<Array<{ c: bigint }>>(`SELECT count(*)::bigint AS c FROM "${table}"`);
        counts[key] = Number(r[0]?.c ?? 0);
      } catch {
        counts[key] = "error";
      }
    }
    result.counts = counts;

    if (names.includes("legal_articles")) {
      try {
        const r = await prisma.$queryRawUnsafe<Array<{ c: bigint }>>(
          `SELECT count(*)::bigint AS c FROM "legal_articles" WHERE "embedding" IS NOT NULL`
        );
        result.legalArticleEmbeddingsCount = Number(r[0]?.c ?? 0);
      } catch {
        result.legalArticleEmbeddingsCount = "error";
      }
      const names3 = await prisma
        .$queryRawUnsafe<Array<{ name: string }>>(`SELECT name FROM "legal_systems" ORDER BY name LIMIT 3`)
        .catch(() => [] as Array<{ name: string }>);
      result.firstLegalSystemNames = names3.map((x) => x.name);
    }
    if (names.includes("judicial_cases")) {
      const ids = await prisma
        .$queryRawUnsafe<Array<{ id: string }>>(`SELECT id FROM "judicial_cases" LIMIT 3`)
        .catch(() => [] as Array<{ id: string }>);
      result.firstJudicialCaseIds = ids.map((x) => x.id);
    }
  } catch (e) {
    result.connectionWorks = false;
    result.error = e instanceof Error ? e.message.split("\n")[0].slice(0, 100) : "connection failed";
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }
  return result;
}

async function auditMysql(label: string, url: string) {
  const fp = fingerprint(url);
  const result: Record<string, unknown> = { label, databaseType: "mysql", safeHostFingerprint: fp };
  try {
    const mysql = await import("mysql2/promise");
    const conn = await mysql.createConnection(url);
    try {
      const [tbls] = await conn.query<import("mysql2").RowDataPacket[]>("SHOW TABLES");
      const names = (tbls as Array<Record<string, string>>).map((row) => Object.values(row)[0]);
      result.connectionWorks = true;
      result.tablesCount = names.length;
      result.tables = names.slice(0, 40);
      result.hasAhkamMoj = names.includes("ahkam_moj");
      if (names.includes("ahkam_moj")) {
        const [c] = await conn.query<import("mysql2").RowDataPacket[]>("SELECT COUNT(*) AS c FROM ahkam_moj");
        result.ahkamMojCount = Number((c as Array<{ c: number }>)[0]?.c ?? 0);
      }
    } finally {
      await conn.end();
    }
  } catch (e) {
    result.connectionWorks = false;
    result.error = e instanceof Error ? e.message.split("\n")[0].slice(0, 100) : "connection failed";
  }
  return result;
}

async function main() {
  console.log("🔎 Audit DB Environments — قراءة فقط، بلا كشف أسرار");
  console.log("=".repeat(56));

  const audited: unknown[] = [];
  for (const v of PG_VARS) {
    const url = process.env[v];
    if (!url) {
      console.log(`  ⏭️  ${v}: no connection configured`);
      audited.push({ label: v, status: "no connection configured" });
      continue;
    }
    console.log(`  → فحص ${v} ...`);
    audited.push(await auditPostgres(v, url));
  }
  for (const v of MYSQL_VARS) {
    const url = process.env[v];
    if (!url) {
      console.log(`  ⏭️  ${v}: no connection configured`);
      audited.push({ label: v, status: "no connection configured" });
      continue;
    }
    console.log(`  → فحص ${v} (mysql) ...`);
    audited.push(await auditMysql(v, url));
  }

  console.log("\n" + "=".repeat(56));
  console.log(JSON.stringify({ inspectedAt: new Date().toISOString(), databases: audited }, null, 2));
}

main().catch((e) => {
  console.error("✗ خطأ:", e instanceof Error ? e.message.split("\n")[0] : e);
  process.exit(1);
});

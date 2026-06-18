import { createHash } from "crypto";
import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";

export type CountResult = {
  exists: boolean;
  count: number | null;
  tableMissing?: boolean;
  error?: "count_failed";
};

export type DatabaseFingerprint = {
  providerGuess: string;
  hostType: string;
  projectRefIfSupabase: string | null;
  regionIfDetected: string | null;
  dbNameIfDetected: string | null;
  isPooler: boolean;
  hostFingerprint: string | null;
};

export const DIAGNOSTIC_TABLES = [
  "legal_systems",
  "legal_articles",
  "judicial_cases",
  "judicial_principles",
  "legal_article_case_links",
  "legal_relations",
  "embeddings",
  "users",
  "cases",
  "simulation_judgments",
  "simulation_sessions",
  "consultations",
  "attachments"
] as const;

export type DiagnosticTable = (typeof DIAGNOSTIC_TABLES)[number];

export const KNOWN_GITHUB_DATABASE = {
  projectRef: "bnzicgymocelefeqiwig",
  legalSystems: 9,
  legalArticles: 1981,
  judicialCases: 0
};

export function isRuntimeDiagnosticsEnabled(env: NodeJS.ProcessEnv = process.env) {
  return env.ENABLE_RUNTIME_DIAGNOSTICS === "true";
}

export function isDiagnosticTokenAuthorized(requestToken: string | null, env: NodeJS.ProcessEnv = process.env) {
  const expectedToken = env.RUNTIME_DIAGNOSTIC_TOKEN;
  return Boolean(expectedToken && requestToken && requestToken === expectedToken);
}

function hashHost(hostname: string) {
  return createHash("sha256").update(hostname).digest("hex").slice(0, 12);
}

function detectSupabaseProjectRef(parsed: URL, isSupabaseHost: boolean) {
  if (!isSupabaseHost) return null;

  const directMatch = parsed.hostname.match(/^db\.([a-z0-9-]+)\.supabase\.co$/i);
  if (directMatch?.[1]) return directMatch[1];

  const usernameMatch = decodeURIComponent(parsed.username || "").match(/^postgres\.([a-z0-9-]+)$/i);
  if (usernameMatch?.[1]) return usernameMatch[1];

  return null;
}

function detectRegion(hostname: string) {
  const supabasePoolerMatch = hostname.match(/(?:^|\.)aws-\d-([a-z]+-[a-z]+-\d)\.pooler\.supabase\.com$/i);
  if (supabasePoolerMatch?.[1]) return supabasePoolerMatch[1];

  const neonMatch = hostname.match(/\.([a-z]+-[a-z]+-\d)\.aws\.neon\.tech$/i);
  if (neonMatch?.[1]) return neonMatch[1];

  return null;
}

export function getDatabaseFingerprint(databaseUrl = process.env.DATABASE_URL): DatabaseFingerprint {
  if (!databaseUrl) {
    return {
      providerGuess: "unknown",
      hostType: "missing_database_url",
      projectRefIfSupabase: null,
      regionIfDetected: null,
      dbNameIfDetected: null,
      isPooler: false,
      hostFingerprint: null
    };
  }

  try {
    const parsed = new URL(databaseUrl);
    const hostname = parsed.hostname.toLowerCase();
    const isSupabase = hostname.includes("supabase.com") || hostname.includes("supabase.co");
    const isPooler = hostname.includes("pooler.supabase.com") || hostname.includes("pooler");
    const isNeon = hostname.includes("neon.tech");
    const isVercelPostgres = hostname.includes("postgres.vercel-storage.com") || hostname.includes("vercel-storage.com");

    let hostType = "postgresql";
    let providerGuess = parsed.protocol.replace(":", "") || "postgresql";

    if (isSupabase && isPooler) {
      hostType = "supabase-pooler";
      providerGuess = "supabase";
    } else if (isSupabase) {
      hostType = "supabase-direct";
      providerGuess = "supabase";
    } else if (isNeon) {
      hostType = "neon";
      providerGuess = "neon";
    } else if (isVercelPostgres) {
      hostType = "vercel-postgres";
      providerGuess = "vercel-postgres";
    }

    const dbName = decodeURIComponent(parsed.pathname.replace(/^\//, "")) || null;

    return {
      providerGuess,
      hostType,
      projectRefIfSupabase: detectSupabaseProjectRef(parsed, isSupabase),
      regionIfDetected: detectRegion(hostname),
      dbNameIfDetected: dbName,
      isPooler,
      hostFingerprint: hashHost(hostname)
    };
  } catch {
    return {
      providerGuess: "unknown",
      hostType: "unparseable_database_url",
      projectRefIfSupabase: null,
      regionIfDetected: null,
      dbNameIfDetected: null,
      isPooler: false,
      hostFingerprint: null
    };
  }
}

export function assertDiagnosticTable(tableName: string): asserts tableName is DiagnosticTable {
  if (!DIAGNOSTIC_TABLES.includes(tableName as DiagnosticTable)) {
    throw new Error("Table is not allowed for runtime diagnostics");
  }
}

async function tableExists(prisma: PrismaClient, tableName: DiagnosticTable) {
  const rows = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ${tableName}
    ) AS "exists"
  `;

  return Boolean(rows[0]?.exists);
}

async function columnExists(prisma: PrismaClient, tableName: DiagnosticTable, columnName: string) {
  const rows = await prisma.$queryRaw<Array<{ exists: boolean }>>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = ${tableName}
        AND column_name = ${columnName}
    ) AS "exists"
  `;

  return Boolean(rows[0]?.exists);
}

export async function countAllowedTable(prisma: PrismaClient, tableName: DiagnosticTable): Promise<CountResult> {
  assertDiagnosticTable(tableName);

  try {
    const exists = await tableExists(prisma, tableName);
    if (!exists) {
      return { exists: false, count: null, tableMissing: true };
    }

    const rows = await prisma.$queryRaw<Array<{ count: bigint | number | string }>>(
      Prisma.sql`SELECT count(*)::bigint AS count FROM ${Prisma.raw(`"${tableName}"`)}`
    );
    const count = Number(rows[0]?.count ?? 0);

    return { exists: true, count };
  } catch {
    return { exists: true, count: null, error: "count_failed" };
  }
}

export async function countLegalArticlesWithEmbedding(prisma: PrismaClient) {
  try {
    const hasTable = await tableExists(prisma, "legal_articles");
    if (!hasTable) return null;

    const hasEmbedding = await columnExists(prisma, "legal_articles", "embedding");
    if (!hasEmbedding) return null;

    const rows = await prisma.$queryRaw<Array<{ count: bigint | number | string }>>`
      SELECT count(*)::bigint AS count
      FROM legal_articles
      WHERE embedding IS NOT NULL
    `;

    return Number(rows[0]?.count ?? 0);
  } catch {
    return null;
  }
}

export function buildComparison(
  fingerprint: DatabaseFingerprint,
  counts: Record<DiagnosticTable, CountResult>
) {
  const matchesGithubProjectRef = fingerprint.projectRefIfSupabase
    ? fingerprint.projectRefIfSupabase === KNOWN_GITHUB_DATABASE.projectRef
    : null;
  const legalSystems = counts.legal_systems.count;
  const legalArticles = counts.legal_articles.count;
  const judicialCases = counts.judicial_cases.count;
  const matchesGithubCounts = [legalSystems, legalArticles, judicialCases].every((value) => typeof value === "number")
    ? legalSystems === KNOWN_GITHUB_DATABASE.legalSystems &&
      legalArticles === KNOWN_GITHUB_DATABASE.legalArticles &&
      judicialCases === KNOWN_GITHUB_DATABASE.judicialCases
    : null;
  const likelySameDatabase = matchesGithubProjectRef === true || matchesGithubCounts === true;

  let conclusion = "Unable to prove whether this is the known GitHub database.";
  if (matchesGithubProjectRef === true) {
    conclusion = "Runtime database appears to use the known GitHub Supabase projectRef.";
  } else if (matchesGithubProjectRef === false) {
    conclusion = "Runtime database Supabase projectRef differs from the known GitHub database.";
  } else if (matchesGithubCounts === true) {
    conclusion = "Runtime counts match the known GitHub database counts, but projectRef was not detected.";
  } else if (matchesGithubCounts === false) {
    conclusion = "Runtime counts differ from the known GitHub database counts.";
  }

  return {
    matchesGithubProjectRef,
    matchesGithubCounts,
    likelySameDatabase,
    conclusion
  };
}

export function buildProof(counts: Record<DiagnosticTable, CountResult>) {
  return {
    legalSystems489Proven: counts.legal_systems.count === 489,
    legalArticles15902Proven: counts.legal_articles.count === 15902,
    judicialCases51105Proven: counts.judicial_cases.count === 51105
  };
}

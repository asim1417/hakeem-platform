import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CountValue = number | "model_not_available" | "count_failed";

type DatabaseFingerprint = {
  providerGuess: string;
  hostType: string;
  projectRefIfSupabase: string | null;
  regionIfDetected: string | null;
  dbNameIfDetected: string | null;
  isPooler: boolean;
  hostFingerprint: string | null;
};

const KNOWN_GITHUB_DATABASE = {
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

  const directMatch = parsed.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/i);
  if (directMatch?.[1]) return directMatch[1];

  const usernameMatch = decodeURIComponent(parsed.username || "").match(/^postgres\.([a-z0-9]+)$/i);
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

async function safeCount(modelKey: string): Promise<CountValue> {
  const delegate = (prisma as unknown as Record<string, { count?: () => Promise<number> } | undefined>)[modelKey];

  if (!delegate || typeof delegate.count !== "function") {
    return "model_not_available";
  }

  try {
    return await delegate.count();
  } catch {
    return "count_failed";
  }
}

function countsMatchGithub(counts: { legalSystems: CountValue; legalArticles: CountValue; judicialCases: CountValue }) {
  if (
    typeof counts.legalSystems !== "number" ||
    typeof counts.legalArticles !== "number" ||
    typeof counts.judicialCases !== "number"
  ) {
    return null;
  }

  return (
    counts.legalSystems === KNOWN_GITHUB_DATABASE.legalSystems &&
    counts.legalArticles === KNOWN_GITHUB_DATABASE.legalArticles &&
    counts.judicialCases === KNOWN_GITHUB_DATABASE.judicialCases
  );
}

function buildComparison(fingerprint: DatabaseFingerprint, counts: { legalSystems: CountValue; legalArticles: CountValue; judicialCases: CountValue }) {
  const matchesGithubProjectRef = fingerprint.projectRefIfSupabase
    ? fingerprint.projectRefIfSupabase === KNOWN_GITHUB_DATABASE.projectRef
    : null;
  const matchesGithubCounts = countsMatchGithub(counts);
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

export async function GET(request: NextRequest) {
  if (!isRuntimeDiagnosticsEnabled()) {
    return new NextResponse(null, { status: 404 });
  }

  if (!isDiagnosticTokenAuthorized(request.headers.get("x-diagnostic-token"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [
    legalSystems,
    legalArticles,
    judicialCases,
    judicialPrinciples,
    legalArticleCaseLinks,
    legalRelations,
    embeddings,
    users,
    cases,
    simulationJudgments
  ] = await Promise.all([
    safeCount("legalSystem"),
    safeCount("legalArticle"),
    safeCount("judicialCase"),
    safeCount("judicialPrinciple"),
    safeCount("legalArticleCaseLink"),
    safeCount("legalRelation"),
    safeCount("embedding"),
    safeCount("user"),
    safeCount("caseFile"),
    safeCount("simulationJudgment")
  ]);

  const counts = {
    legalSystems,
    legalArticles,
    judicialCases,
    judicialPrinciples,
    legalArticleCaseLinks,
    legalRelations,
    embeddings,
    users,
    cases,
    simulationJudgments
  };
  const databaseFingerprint = getDatabaseFingerprint();

  return NextResponse.json({
    runtime: "vercel",
    databaseFingerprint,
    counts,
    knownGithubDatabase: KNOWN_GITHUB_DATABASE,
    comparison: buildComparison(databaseFingerprint, counts)
  });
}

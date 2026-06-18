import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  buildComparison,
  buildProof,
  countAllowedTable,
  countLegalArticlesWithEmbedding,
  DIAGNOSTIC_TABLES,
  getDatabaseFingerprint,
  isDiagnosticTokenAuthorized,
  isRuntimeDiagnosticsEnabled,
  KNOWN_GITHUB_DATABASE
} from "@/lib/modules/diagnostics/runtime-db-proof";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (!isRuntimeDiagnosticsEnabled()) {
    return new NextResponse(null, { status: 404 });
  }

  if (!isDiagnosticTokenAuthorized(request.headers.get("x-diagnostic-token"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const countEntries = await Promise.all(
    DIAGNOSTIC_TABLES.map(async (tableName) => [tableName, await countAllowedTable(prisma, tableName)] as const)
  );
  const counts = Object.fromEntries(countEntries) as Record<(typeof DIAGNOSTIC_TABLES)[number], Awaited<ReturnType<typeof countAllowedTable>>>;
  const databaseFingerprint = getDatabaseFingerprint();

  return NextResponse.json({
    runtime: "vercel",
    diagnosticsEnabled: true,
    databaseFingerprint,
    counts,
    legalArticleEmbeddingCount: await countLegalArticlesWithEmbedding(prisma),
    knownGithubDatabase: KNOWN_GITHUB_DATABASE,
    comparison: buildComparison(databaseFingerprint, counts),
    proof: buildProof(counts)
  });
}

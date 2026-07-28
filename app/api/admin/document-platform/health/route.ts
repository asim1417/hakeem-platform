import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { azureConfigured, sharePointConfigured } from "@/lib/modules/attachments/blob-storage";
import {
  isDocumentMalwareScanEnabled,
  isDocumentMetricsEnabled,
  isDocumentQueueEnabled,
  isDirectUrlImportEnabledSafe
} from "@/lib/modules/documents/document-platform-status";
import { getMalwareScanner } from "@/lib/modules/documents/malware";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const gate = await requireApiPermission("ADMIN_REPORTS_VIEW", request);
  if (gate.response) return gate.response;

  let database: "ok" | "error" = "ok";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = "error";
  }

  const redisConfigured = Boolean(process.env.REDIS_URL || process.env.DOCUMENT_REDIS_URL);
  const scanner = getMalwareScanner();
  const malwareAvailable = isDocumentMalwareScanEnabled() ? await scanner.available() : false;

  const depsDegraded = database !== "ok";
  return NextResponse.json({
    status: depsDegraded ? "degraded" : "healthy",
    features: {
      directUrlImport: isDirectUrlImportEnabledSafe(),
      malwareScan: isDocumentMalwareScanEnabled(),
      queue: isDocumentQueueEnabled(),
      metrics: isDocumentMetricsEnabled()
    },
    dependencies: {
      database,
      blobStorage: azureConfigured() || sharePointConfigured() ? "ok" : "metadata_only",
      redis: redisConfigured ? "configured" : "not_configured",
      malwareScanner: !isDocumentMalwareScanEnabled()
        ? "not_configured"
        : malwareAvailable
          ? "ok"
          : "not_configured"
    }
  });
}

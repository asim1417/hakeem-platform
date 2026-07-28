import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { auditEvent } from "@/lib/modules/audit/audit";
import { isDirectUrlImportEnabled, isDocumentRateLimitEnabled } from "@/lib/modules/documents/feature-flags";
import { getDocumentLimits } from "@/lib/modules/documents/document-limits";
import { getRateLimiter } from "@/lib/modules/rate-limit";
import { resolveConnectorForUrl } from "@/lib/modules/documents/connectors/registry";
import { DirectUrlError } from "@/lib/modules/documents/connectors/direct-url";
import { redactSensitiveUrl, urlContainsSensitiveQuery } from "@/lib/modules/documents/url-security";
import { createCorrelationId, documentLog } from "@/lib/modules/observability/document-logger";
import { recordDocumentMetric } from "@/lib/modules/observability/metrics";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  url: z.string().min(8).max(4000)
});

export async function POST(request: NextRequest) {
  const correlationId = createCorrelationId();
  if (!isDirectUrlImportEnabled()) {
    return NextResponse.json({ message: "لم يتم العثور على المورد." }, { status: 404 });
  }

  const gate = await requireApiPermission("ATTACHMENTS_FULL", request);
  if (gate.response) return gate.response;
  const user = gate.user!;

  if (isDocumentRateLimitEnabled()) {
    const limits = getDocumentLimits();
    const rate = await getRateLimiter().consume({
      key: user.id,
      scope: "inspect-url",
      limit: limits.rateLimitInspectMax,
      windowSeconds: limits.rateLimitWindowSeconds
    });
    if (!rate.allowed) {
      await auditEvent({
        actorId: user.id,
        subject: "ADMIN",
        action: "ATTACHMENT_RATE_LIMITED",
        metadata: { scope: "inspect-url", correlationId }
      }).catch(() => undefined);
      recordDocumentMetric("document_rate_limited_total", 1, { provider: "DIRECT_URL", errorCode: "RATE_LIMITED" });
      return NextResponse.json(
        { message: "تجاوزت حد الطلبات. حاول لاحقًا.", code: "RATE_LIMITED" },
        {
          status: 429,
          headers: { "Retry-After": String(rate.retryAfterSeconds ?? limits.rateLimitWindowSeconds) }
        }
      );
    }
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ message: "جسم الطلب غير صالح." }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ message: "رابط غير صالح." }, { status: 400 });
  }

  const { connector, provider, deferred } = resolveConnectorForUrl(parsed.data.url);
  if (deferred || !connector) {
    return NextResponse.json(
      {
        message: "هذا المزوّد غير مدعوم في هذه المرحلة. استخدم رابط HTTPS مباشرًا للملف.",
        provider,
        deferred: true
      },
      { status: 400 }
    );
  }

  try {
    const inspected = await connector.inspect({ url: parsed.data.url });
    documentLog({
      level: "info",
      event: "document.inspect.ok",
      correlationId,
      userId: user.id,
      provider: "DIRECT_URL",
      status: "ok",
      bytes: inspected.reportedSize ?? undefined
    });
    await auditEvent({
      actorId: user.id,
      subject: "ADMIN",
      action: "ATTACHMENT_URL_INSPECTED",
      metadata: {
        host: inspected.finalHost,
        fileName: inspected.fileName,
        reportedSize: inspected.reportedSize,
        reportedMimeType: inspected.reportedMimeType,
        redirects: inspected.redirects,
        accessible: inspected.accessible,
        hadSensitiveQuery: urlContainsSensitiveQuery(parsed.data.url),
        displayHost: inspected.finalHost,
        correlationId
      }
    });

    return NextResponse.json({
      provider: inspected.provider,
      normalizedUrl: redactSensitiveUrl(inspected.safeDisplayUrl),
      fileName: inspected.fileName,
      reportedMimeType: inspected.reportedMimeType,
      reportedSize: inspected.reportedSize,
      requiresAuthentication: inspected.requiresAuthentication,
      accessible: inspected.accessible,
      warnings: inspected.warnings,
      redirects: inspected.redirects,
      finalHost: inspected.finalHost,
      correlationId
    });
  } catch (err) {
    if (err instanceof DirectUrlError) {
      if (err.code === "URL_REJECTED") {
        recordDocumentMetric("document_ssrf_blocked_total", 1, {
          provider: "DIRECT_URL",
          errorCode: err.securityReason || err.code
        });
      }
      documentLog({
        level: "warn",
        event: "document.inspect.failed",
        correlationId,
        userId: user.id,
        provider: "DIRECT_URL",
        status: "failed",
        errorCode: err.code
      });
      return NextResponse.json(
        { message: err.message, code: err.code, reasonCode: err.securityReason, correlationId },
        { status: 400 }
      );
    }
    return NextResponse.json({ message: "تعذّر فحص الرابط.", correlationId }, { status: 502 });
  }
}

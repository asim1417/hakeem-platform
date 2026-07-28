import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { auditEvent } from "@/lib/modules/audit/audit";
import { isDirectUrlImportEnabled } from "@/lib/modules/documents/feature-flags";
import { consumeDirectUrlRateLimit } from "@/lib/modules/documents/rate-limit";
import { resolveConnectorForUrl } from "@/lib/modules/documents/connectors/registry";
import { DirectUrlError } from "@/lib/modules/documents/connectors/direct-url";
import { redactSensitiveUrl, urlContainsSensitiveQuery } from "@/lib/modules/documents/url-security";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  url: z.string().min(8).max(4000)
});

export async function POST(request: NextRequest) {
  if (!isDirectUrlImportEnabled()) {
    return NextResponse.json({ message: "لم يتم العثور على المورد." }, { status: 404 });
  }

  const gate = await requireApiPermission("ATTACHMENTS_FULL", request);
  if (gate.response) return gate.response;
  const user = gate.user!;

  const rate = consumeDirectUrlRateLimit(`inspect:${user.id}`);
  if (!rate.allowed) {
    return NextResponse.json(
      { message: "تجاوزت حد الطلبات. حاول لاحقًا." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } }
    );
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
        displayHost: inspected.finalHost
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
      finalHost: inspected.finalHost
    });
  } catch (err) {
    if (err instanceof DirectUrlError) {
      return NextResponse.json(
        { message: err.message, code: err.code, reasonCode: err.securityReason },
        { status: 400 }
      );
    }
    return NextResponse.json({ message: "تعذّر فحص الرابط." }, { status: 502 });
  }
}

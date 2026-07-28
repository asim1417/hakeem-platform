import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/modules/auth/session";
import { assertCaseOwnedForAttachment } from "@/lib/modules/auth/ownership";
import { auditEvent } from "@/lib/modules/audit/audit";
import { toAttachmentDto } from "@/lib/modules/attachments/attachment-metadata";
import { uploadAttachmentFromPath } from "@/lib/modules/attachments/blob-storage";
import { isDirectUrlImportEnabled } from "@/lib/modules/documents/feature-flags";
import { consumeDirectUrlRateLimit } from "@/lib/modules/documents/rate-limit";
import { resolveConnectorForUrl } from "@/lib/modules/documents/connectors/registry";
import {
  cleanupDownloadedFile,
  DirectUrlError
} from "@/lib/modules/documents/connectors/direct-url";
import { redactSensitiveUrl, urlContainsSensitiveQuery } from "@/lib/modules/documents/url-security";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bodySchema = z.object({
  url: z.string().min(8).max(4000),
  relationType: z.string().max(40).optional(),
  relationId: z.string().max(80).optional()
});

export async function POST(request: NextRequest) {
  if (!isDirectUrlImportEnabled()) {
    return NextResponse.json({ message: "لم يتم العثور على المورد." }, { status: 404 });
  }

  const gate = await requireApiPermission("ATTACHMENTS_FULL", request);
  if (gate.response) return gate.response;
  const user = gate.user!;

  const rate = consumeDirectUrlRateLimit(`import:${user.id}`);
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
    return NextResponse.json({ message: "مدخلات غير صالحة." }, { status: 400 });
  }

  const relationType = parsed.data.relationType || "عام";
  const relationId = parsed.data.relationId || "";
  const caseId = relationType === "قضية" && relationId ? relationId : undefined;
  const caseGate = await assertCaseOwnedForAttachment(user, caseId);
  if (!caseGate.ok) return NextResponse.json({ message: caseGate.message }, { status: 403 });

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

  const safeHost = (() => {
    try {
      return new URL(parsed.data.url).host;
    } catch {
      return "unknown";
    }
  })();

  await auditEvent({
    actorId: user.id,
    subject: "ADMIN",
    action: "ATTACHMENT_URL_IMPORT_STARTED",
    metadata: {
      host: safeHost,
      relationType,
      hadSensitiveQuery: urlContainsSensitiveQuery(parsed.data.url)
    }
  });

  // أنشئ السجل مبكرًا بحالة DOWNLOADING لتتبع الفشل
  let attachmentId: string | null = null;
  try {
    const placeholder = await prisma.attachment.create({
      data: {
        caseId,
        fileName: "importing...",
        mimeType: "application/octet-stream",
        storageKey: `pending/${Date.now()}`,
        extractedText: null,
        metadata: {
          relationType,
          relationId: relationId || undefined,
          uploadedBy: user.id,
          source: "direct-url",
          safeDisplayUrl: redactSensitiveUrl(parsed.data.url)
        },
        processingStatus: "DOWNLOADING",
        sourceProvider: "DIRECT_URL"
      }
    });
    attachmentId = placeholder.id;

    const downloaded = await connector.download({ url: parsed.data.url });
    try {
      let uploaded;
      try {
        uploaded = await uploadAttachmentFromPath({
          filePath: downloaded.temporaryPath,
          fileName: downloaded.fileName,
          mimeType: downloaded.detectedMimeType,
          size: downloaded.size,
          prefix: relationType
        });
      } catch {
        throw new DirectUrlError("STORAGE_UPLOAD_FAILED", "تعذّر حفظ الملف في التخزين.");
      }

      const metadata = {
        size: downloaded.size,
        relationType,
        relationId: relationId || undefined,
        uploadedBy: user.id,
        storageMode: uploaded.storageMode,
        storageUrl: uploaded.url,
        source: "direct-url",
        safeDisplayUrl: redactSensitiveUrl(parsed.data.url),
        sha256Prefix: downloaded.sha256.slice(0, 12)
      };

      const attachment = await prisma.attachment.update({
        where: { id: placeholder.id },
        data: {
          fileName: downloaded.fileName,
          mimeType: downloaded.detectedMimeType,
          storageKey: uploaded.storageKey,
          extractedText: null,
          metadata,
          processingStatus: "UPLOADED",
          sourceProvider: "DIRECT_URL",
          sha256: downloaded.sha256,
          fileSize: BigInt(downloaded.size),
          detectedMimeType: downloaded.detectedMimeType
        },
        include: { caseFile: { select: { id: true, title: true } } }
      });

      await auditEvent({
        actorId: user.id,
        subject: "ADMIN",
        action: "ATTACHMENT_URL_IMPORTED",
        entityId: attachment.id,
        metadata: {
          host: safeHost,
          fileName: attachment.fileName,
          size: downloaded.size,
          mimeType: downloaded.detectedMimeType,
          sha256Prefix: downloaded.sha256.slice(0, 12),
          storageMode: uploaded.storageMode
        }
      });

      return NextResponse.json({ attachment: toAttachmentDto(attachment) }, { status: 201 });
    } finally {
      await cleanupDownloadedFile(downloaded);
    }
  } catch (err) {
    const code = err instanceof DirectUrlError ? err.code : "DOWNLOAD_FAILED";
    if (attachmentId) {
      await prisma.attachment
        .update({
          where: { id: attachmentId },
          data: {
            processingStatus: "FAILED",
            extractionErrorCode: code
          }
        })
        .catch(() => undefined);
    }
    await auditEvent({
      actorId: user.id,
      subject: "ADMIN",
      action: "ATTACHMENT_URL_IMPORT_FAILED",
      entityId: attachmentId ?? undefined,
      metadata: { host: safeHost, code }
    }).catch(() => undefined);

    if (err instanceof DirectUrlError) {
      return NextResponse.json(
        { message: err.message, code: err.code, reasonCode: err.securityReason, attachmentId },
        { status: 400 }
      );
    }
    return NextResponse.json({ message: "تعذّر استيراد الرابط.", code, attachmentId }, { status: 502 });
  }
}

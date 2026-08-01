import type { AuditSubject, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function auditEvent(input: {
  actorId?: string;
  subject: AuditSubject;
  action: string;
  entityId?: string;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string;
  // ── مغلّف الحدث (§6) — كلّها اختيارية؛ النداءات القديمة تعمل دون تغيير.
  correlationId?: string;
  causationId?: string;
  schemaVersion?: string;
}) {
  const base = {
    actorId: input.actorId,
    subject: input.subject,
    action: input.action,
    entityId: input.entityId,
    metadata: input.metadata,
    ipAddress: input.ipAddress
  };

  // إن لم يُمرَّر معرّف الارتباط، نقرؤه من رأس الطلب الذي حقنه middleware.
  // دفاعيّ: خارج سياق الطلب (سكربتات/وظائف) يبقى undefined فيتولّاه المغلّف لاحقًا.
  let correlationId = input.correlationId;
  if (!correlationId) {
    try {
      const { getRequestCorrelationId } = await import("./request-context");
      correlationId = getRequestCorrelationId();
    } catch {
      /* لا سياق طلب */
    }
  }

  try {
    return await prisma.auditEvent.create({
      data: {
        ...base,
        correlationId: correlationId ?? undefined,
        causationId: input.causationId ?? undefined,
        schemaVersion: input.schemaVersion ?? undefined
      }
    });
  } catch {
    // fail-open: قد لا تكون أعمدة المغلّف مُهاجَرة بعد — نكتب الحدث الأساسيّ دون تعطّل.
    return prisma.auditEvent.create({ data: base });
  }
}

export async function recordGuardrail(input: {
  subject: AuditSubject;
  requestId: string;
  guardName: string;
  result: string;
  details?: Prisma.InputJsonValue;
}) {
  return prisma.guardrailDecision.create({ data: input });
}

// مغلّف الحدث الموحّد — المخطط السيادي §6 (Event Bus) و§23 (التتبّع).
// طبقة إضافية فوق سجلّ التدقيق القائم: لا تُغيّر توقيع auditEvent، بل تُثريه.

import type { AuditSubject } from "@prisma/client";

/** نسخة مخطط الحمولة الافتراضية — تُرفَع عند تغيير بنية metadata. */
export const CURRENT_EVENT_SCHEMA_VERSION = "1";

/** مغلّف الحدث كما يصفه §6: من، ماذا، على أيّ كيان، متى، ولماذا (السببية). */
export type EventEnvelope = {
  eventId?: string;
  type: string; // اسم الحدث، مثل: SuggestionAccepted
  subject: AuditSubject;
  entityId?: string;
  actorId?: string;
  correlationId?: string;
  causationId?: string;
  schemaVersion: string;
  occurredAt: string; // ISO
  payload?: Record<string, unknown>;
};

/** توليد معرّف ارتباط جديد (يُستعمل عند غياب سياق طلب — مثل الوظائف الخلفية). */
export function newCorrelationId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `corr_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

/** بناء مغلّف حدث مكتمل من مدخلات جزئية. لا آثار جانبية. */
export function buildEnvelope(input: {
  type: string;
  subject: AuditSubject;
  entityId?: string;
  actorId?: string;
  correlationId?: string;
  causationId?: string;
  occurredAt: string; // يُمرَّر من المستدعي لتفادي Date.now الخفيّ في النواة النقية
  payload?: Record<string, unknown>;
  schemaVersion?: string;
}): EventEnvelope {
  return {
    type: input.type,
    subject: input.subject,
    entityId: input.entityId,
    actorId: input.actorId,
    correlationId: input.correlationId ?? newCorrelationId(),
    causationId: input.causationId,
    schemaVersion: input.schemaVersion ?? CURRENT_EVENT_SCHEMA_VERSION,
    occurredAt: input.occurredAt,
    payload: input.payload,
  };
}

import type { AuditSubject, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function auditEvent(input: {
  actorId?: string;
  subject: AuditSubject;
  action: string;
  entityId?: string;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string;
}) {
  return prisma.auditEvent.create({
    data: {
      actorId: input.actorId,
      subject: input.subject,
      action: input.action,
      entityId: input.entityId,
      metadata: input.metadata,
      ipAddress: input.ipAddress
    }
  });
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

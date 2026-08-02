import "server-only";

// تدقيق الفوترة — HKM-BILLING-UX-001 (§4/§12). سجل غير قابل للحذف الصامت لكل تغيير مالي.
// يكتب في billing_audit_logs (Prisma) ويعكس حدثًا في audit_logs (subject=BILLING).

export interface BillingAuditInput {
  action: string;
  actorUserId?: string | null;
  targetType?: string;
  targetId?: string;
  reason?: string;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
}

export async function recordBillingAudit(input: BillingAuditInput): Promise<void> {
  try {
    const { prisma } = await import("@/lib/prisma");
    await prisma.billingAuditLog.create({
      data: {
        action: input.action.slice(0, 120),
        actorUserId: input.actorUserId ?? null,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        reason: input.reason ?? null,
        before: (input.before ?? undefined) as never,
        after: (input.after ?? undefined) as never,
        metadata: (input.metadata ?? undefined) as never,
      },
    });
  } catch {
    /* لا نكسر المسار المالي إن فشل التدقيق */
  }
  // عكس إلى سجل التدقيق العام (subject=BILLING).
  try {
    const { auditEvent } = await import("@/lib/modules/audit/audit");
    const metadata: Record<string, unknown> = { ...(input.metadata || {}) };
    if (input.reason) metadata.reason = input.reason;
    await auditEvent({
      actorId: input.actorUserId ?? undefined,
      subject: "BILLING",
      action: input.action,
      entityId: input.targetId,
      metadata: metadata as Record<string, unknown> as never,
    }).catch(() => undefined);
  } catch {
    /* */
  }
}

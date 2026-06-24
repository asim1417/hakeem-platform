import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auditEvent } from "@/lib/modules/audit/audit";
import { requireApiPermission } from "@/lib/modules/auth/session";

export const dynamic = "force-dynamic";

const schema = z.object({
  decision: z.enum(["approve", "reject", "reset"])
});

// خريطة القرار → حالة المراجعة المخزّنة.
const STATUS: Record<string, string> = {
  approve: "reviewed",
  reject: "rejected",
  reset: "needs_review"
};

// PATCH /api/legal-core/principles/[id] — اعتماد/رفض/إعادة مبدأ قضائي مستخرَج.
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireApiPermission("LEGAL_CORE_EDIT", request);
  if (gate.response) return gate.response;
  const actor = gate.user!;

  const { decision } = schema.parse(await request.json());

  const updated = await prisma.judicialPrinciple
    .update({
      where: { id: params.id },
      data: { reviewStatus: STATUS[decision] },
      select: { id: true, title: true, reviewStatus: true }
    })
    .catch(() => null);

  if (!updated) return NextResponse.json({ message: "المبدأ غير موجود." }, { status: 404 });

  await auditEvent({
    actorId: actor.id,
    subject: "LIBRARY",
    action: "PRINCIPLE_REVIEWED",
    entityId: updated.id,
    metadata: { description: `مراجعة مبدأ قضائي: ${decision}`, reviewStatus: updated.reviewStatus }
  }).catch(() => undefined);

  return NextResponse.json({ ok: true, principle: updated });
}

import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/modules/auth/super-admin";
import { grantCredits, adjustCredits, newIdempotencyKey } from "@/lib/modules/billing/credit-engine";
import { recordBillingAudit } from "@/lib/modules/billing/billing-audit";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/billing/users/[id]/grant — منح/سحب نقاط بسبب إلزامي (§12).
 * body: { points: number (موجب=منح ADMIN_GRANT، سالب=سحب/تعديل), reason }
 * لا حذف مباشر للسجل — كل شيء عبر الدفتر.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireSuperAdminApi(request);
  if (gate.response) return gate.response;
  const body = (await request.json().catch(() => ({}))) as { points?: number; reason?: string };
  if (typeof body.points !== "number" || body.points === 0) {
    return NextResponse.json({ message: "قيمة نقاط غير صفرية مطلوبة." }, { status: 400 });
  }
  if (!body.reason) return NextResponse.json({ message: "السبب إلزامي." }, { status: 400 });

  const idem = newIdempotencyKey("admingrant");
  try {
    if (body.points > 0) {
      await grantCredits({
        userId: params.id,
        points: body.points,
        sourceType: "ADMIN_GRANT",
        idempotencyKey: idem,
        description: body.reason,
      });
    } else {
      await adjustCredits({
        userId: params.id,
        points: body.points, // سالب
        actorId: gate.user.id,
        reason: body.reason,
        idempotencyKey: idem,
      });
    }
  } catch (e) {
    return NextResponse.json(
      { message: (e as Error)?.message || "تعذّر تنفيذ العملية." },
      { status: 400 }
    );
  }

  await recordBillingAudit({
    action: body.points > 0 ? "ADMIN_GRANT_POINTS" : "ADMIN_REVOKE_POINTS",
    actorUserId: gate.user.id,
    targetType: "user",
    targetId: params.id,
    reason: body.reason,
    metadata: { points: body.points },
  });
  return NextResponse.json({ ok: true, points: body.points });
}

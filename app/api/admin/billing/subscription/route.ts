import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/modules/auth/super-admin";
import {
  resetUserFreeQuota,
  setUserSubscriptionStatus,
} from "@/lib/modules/billing/admin-overview";
import { auditEvent } from "@/lib/modules/audit/audit";

export const dynamic = "force-dynamic";

/**
 * POST { userId, action: 'activate' | 'revoke' | 'reset_quota' }
 * منح/إلغاء اشتراك أو إعادة ضبط الحصّة — سوبر أدمن فقط + تدقيق.
 */
export async function POST(request: NextRequest) {
  const gate = await requireSuperAdminApi(request);
  if (gate.response) return gate.response;

  const body = (await request.json().catch(() => ({}))) as {
    userId?: string;
    action?: string;
  };
  const userId = (body.userId || "").trim();
  const action = (body.action || "").trim();
  if (!userId || !["activate", "revoke", "reset_quota"].includes(action)) {
    return NextResponse.json({ ok: false, message: "طلب غير صالح." }, { status: 400 });
  }

  let ok = false;
  if (action === "activate") ok = await setUserSubscriptionStatus(userId, "active");
  else if (action === "revoke") ok = await setUserSubscriptionStatus(userId, "free");
  else ok = await resetUserFreeQuota(userId);

  if (!ok) {
    return NextResponse.json(
      { ok: false, message: "تعذّر تحديث حالة الفوترة (تحقق من هجرة الحصّة)." },
      { status: 500 }
    );
  }

  await auditEvent({
    actorId: gate.user.id,
    subject: "ADMIN",
    action: `BILLING_${action.toUpperCase()}`,
    entityId: userId,
    metadata: { action },
  }).catch(() => undefined);

  return NextResponse.json({ ok: true, userId, action });
}

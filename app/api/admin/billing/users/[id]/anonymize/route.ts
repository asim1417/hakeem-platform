import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/modules/auth/super-admin";
import { anonymizeUserBillingData } from "@/lib/modules/billing/data-lifecycle";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/billing/users/[id]/anonymize — إخفاء هوية بيانات فوترة المستخدم (PDPL).
 * لا يمسّ الفواتير (احتفاظ ضريبي)؛ يزيل وسائل الدفع ويُنقّي الحمولات الخام.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireSuperAdminApi(request);
  if (gate.response) return gate.response;
  const result = await anonymizeUserBillingData(params.id);
  return NextResponse.json({ ok: true, ...result });
}

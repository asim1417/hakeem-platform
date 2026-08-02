import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from "@/lib/modules/auth/session";
import { grantInitialTrial, grantProfileCompletionTrial } from "@/lib/modules/billing/trial";

export const dynamic = "force-dynamic";

/**
 * POST /api/billing/trial/claim — منح نقاط التجربة للمستخدم الحالي (idempotent).
 * يُستدعى من تدفّق التسجيل/إكمال الملف. no-op قبل تفعيل نظام النقاط.
 * body: { stage: 'initial'|'profile' }
 */
export async function POST(request: NextRequest) {
  const user = await getApiUser(request);
  if (!user?.isActive) return NextResponse.json({ message: "يلزم تسجيل الدخول." }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { stage?: string; phone?: string };

  // رقم الجوال (إن وُجد) لتجزئة الهوية — يُقرأ من users إن لم يُمرّر.
  let phone = body.phone ?? null;
  if (!phone) {
    try {
      const { prisma } = await import("@/lib/prisma");
      const rows = await prisma.$queryRawUnsafe<{ phone: string | null }[]>(
        `SELECT "phone" FROM "users" WHERE id = $1 LIMIT 1`,
        user.id
      );
      phone = rows[0]?.phone ?? null;
    } catch {
      /* */
    }
  }

  const result =
    body.stage === "profile"
      ? await grantProfileCompletionTrial({ userId: user.id, email: user.email, phone })
      : await grantInitialTrial({ userId: user.id, email: user.email, phone });

  return NextResponse.json({ ok: true, granted: result.granted, points: result.points });
}

import { NextResponse } from "next/server";
import { ensurePlatformOwner, OWNER_DEFAULT_EMAIL, OWNER_DEFAULT_USERNAME } from "@/lib/modules/auth/ensure-owner";
import { isGoogleOAuthConfigured } from "@/lib/modules/auth/google-oauth";

export const dynamic = "force-dynamic";

/**
 * POST /api/auth/ensure-owner — يفعّل حساب المالك في القاعدة من داخل المنصة.
 * لا يكشف كلمة المرور. يُستدعى من صفحة الدخول عند الحاجة.
 */
export async function POST() {
  try {
    const owner = await ensurePlatformOwner();
    return NextResponse.json({
      ok: true,
      email: owner.email,
      username: owner.username,
      created: owner.created,
      googleEnabled: isGoogleOAuthConfigured(),
      message: owner.created
        ? "تم إنشاء حساب المالك — ادخل بالبريد وكلمة المرور."
        : "حساب المالك جاهز — ادخل بالبريد وكلمة المرور.",
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: (e as Error)?.message || "تعذّر تفعيل حساب المالك." },
      { status: 500 }
    );
  }
}

/** GET — حالة التفعيل فقط (بدون إنشاء إن فشل الإقلاع). */
export async function GET() {
  return NextResponse.json({
    ownerEmail: OWNER_DEFAULT_EMAIL,
    ownerUsername: OWNER_DEFAULT_USERNAME,
    googleEnabled: isGoogleOAuthConfigured(),
  });
}

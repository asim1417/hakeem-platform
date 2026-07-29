import { NextResponse } from "next/server";

/**
 * أُلغي تفعيل المالك بكلمة مرور من الواجهة.
 * الدخول عبر مزوّد المصادقة المعتمد (Clerk / Google).
 */
export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      message: "تفعيل المالك من هذه الواجهة لم يعد متاحًا. سجّل الدخول عبر صفحة الدخول المعتمدة.",
      redirect: "/sign-in",
    },
    { status: 410 }
  );
}

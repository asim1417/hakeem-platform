import { NextResponse } from "next/server";

/**
 * أُلغي تفعيل المالك بكلمة مرور.
 * سجّل في Clerk بالبريد aasemalfarsi@gmail.com ليُمنح SYSTEM_ADMIN تلقائيًا.
 */
export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      message:
        "أُلغي تفعيل المالك السابق. ادخل عبر Clerk ببريد المالك aasemalfarsi@gmail.com — يُمنح دور مدير النظام تلقائيًا.",
      redirect: "/sign-in",
    },
    { status: 410 }
  );
}

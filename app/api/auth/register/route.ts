import { NextResponse } from "next/server";

/** أُلغي — استخدم Clerk على /sign-up */
export async function POST() {
  return NextResponse.json(
    { message: "أُلغي التسجيل السابق. استخدم /sign-up (Clerk).", redirect: "/sign-up" },
    { status: 410 }
  );
}

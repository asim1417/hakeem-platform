import { NextResponse } from "next/server";

/** أُلغي — استخدم Clerk على /sign-in */
export async function POST() {
  return NextResponse.json(
    { message: "أُلغيت المصادقة السابقة. استخدم /sign-in (Clerk).", redirect: "/sign-in" },
    { status: 410 }
  );
}

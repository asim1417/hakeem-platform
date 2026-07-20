import { NextResponse } from "next/server";

/** أُلغي — استخدم SignOut من Clerk في الواجهة */
export async function POST() {
  return NextResponse.json(
    { message: "أُلغي تسجيل الخروج القديم. استخدم Clerk SignOut.", redirect: "/" },
    { status: 410 }
  );
}

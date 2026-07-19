import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { message: "أُلغي رابط الدخول القديم. استخدم Clerk على /sign-in." },
    { status: 410 }
  );
}

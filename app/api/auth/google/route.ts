import { NextRequest, NextResponse } from "next/server";

/** أُلغي OAuth اليدوي — فعّل Google من لوحة Clerk */
export async function GET(request: NextRequest) {
  return NextResponse.redirect(new URL("/sign-in", request.url));
}

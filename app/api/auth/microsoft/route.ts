import { NextRequest, NextResponse } from "next/server";

/** أُلغي Entra اليدوي — فعّل Microsoft من لوحة Clerk */
export async function GET(request: NextRequest) {
  return NextResponse.redirect(new URL("/sign-in", request.url));
}

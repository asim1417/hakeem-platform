import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { buildAuthUrl, isDriveConfigured } from "@/lib/modules/doc-platform/google-drive";

export const dynamic = "force-dynamic";

/** يبدأ تدفّق OAuth: يوجّه المستخدم إلى شاشة موافقة Google */
export function GET(request: NextRequest) {
  if (!isDriveConfigured()) {
    return NextResponse.json({ error: "تكامل Drive غير مُهيّأ (GOOGLE_CLIENT_ID/SECRET)" }, { status: 503 });
  }
  const origin = request.nextUrl.origin;
  const state = randomBytes(16).toString("hex");
  const url = buildAuthUrl(origin, state);
  const res = NextResponse.redirect(url);
  // حماية CSRF: نثبّت state في كوكي قصير ونطابقه في callback
  res.cookies.set("docplatform_gdrive_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    path: "/"
  });
  return res;
}

import { NextRequest, NextResponse } from "next/server";
import { exchangeCode, isDriveConfigured } from "@/lib/modules/doc-platform/google-drive";

export const dynamic = "force-dynamic";

/** يستقبل رمز Google، يبادله بالوصول، ويثبّته في كوكي httpOnly ثم يعيد للمحطة */
export async function GET(request: NextRequest) {
  const appUrl = new URL("/documents/app", request.nextUrl.origin);
  if (!isDriveConfigured()) {
    appUrl.searchParams.set("drive", "unconfigured");
    return NextResponse.redirect(appUrl);
  }
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const savedState = request.cookies.get("docplatform_gdrive_state")?.value;
  if (!code || !state || state !== savedState) {
    appUrl.searchParams.set("drive", "error");
    return NextResponse.redirect(appUrl);
  }
  try {
    const token = await exchangeCode(request.nextUrl.origin, code);
    appUrl.searchParams.set("drive", "connected");
    const res = NextResponse.redirect(appUrl);
    res.cookies.set("docplatform_gdrive", token.access_token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: Math.max(60, token.expires_in - 60),
      path: "/"
    });
    res.cookies.set("docplatform_gdrive_state", "", { maxAge: 0, path: "/" });
    return res;
  } catch {
    appUrl.searchParams.set("drive", "error");
    return NextResponse.redirect(appUrl);
  }
}

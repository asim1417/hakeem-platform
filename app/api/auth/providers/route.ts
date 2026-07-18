import { NextResponse } from "next/server";
import { isGoogleOAuthConfigured } from "@/lib/modules/auth/google-oauth";
import { isMicrosoftOAuthConfigured } from "@/lib/modules/auth/microsoft-oauth";

export const dynamic = "force-dynamic";

/** GET /api/auth/providers — يُعلِم الواجهة بالمزوّدين المُفعّلين (بدون كشف أسرار). */
export async function GET() {
  return NextResponse.json({
    google: isGoogleOAuthConfigured(),
    microsoft: isMicrosoftOAuthConfigured(),
    password: true,
  });
}

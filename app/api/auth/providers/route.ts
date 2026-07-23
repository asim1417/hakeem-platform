import { NextResponse } from "next/server";
import {
  isAppleSignInAvailable,
  isGoogleSignInAvailable,
  listVisibleAuthProviders,
  isAuthLaunchReady,
} from "@/lib/modules/auth/auth-providers";
import { isMicrosoftOAuthConfigured } from "@/lib/modules/auth/microsoft-oauth";
import { hydrateEnvFromSettings } from "@/lib/modules/settings/settings-service";

export const dynamic = "force-dynamic";

/** GET /api/auth/providers — الوسائل الظاهرة فعليًا (بدون كشف أسرار). */
export async function GET() {
  await hydrateEnvFromSettings().catch(() => 0);

  return NextResponse.json({
    google: isGoogleSignInAvailable(),
    apple: isAppleSignInAvailable(),
    microsoft: isMicrosoftOAuthConfigured(),
    /** كلمة المرور ليست بوابة عامة — تبقى للحقول الداخلية القديمة فقط. */
    password: false,
    providers: listVisibleAuthProviders(),
    launchReady: isAuthLaunchReady(),
  });
}

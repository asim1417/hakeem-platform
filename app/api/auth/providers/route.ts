import { NextResponse } from "next/server";
import {
  getAccountSecurityFeatures,
  isAppleSignInAvailable,
  isEmailCodeSignInAvailable,
  isGoogleSignInAvailable,
  isMicrosoftSignInAvailable,
  isPhoneSignInAvailable,
  listVisibleAuthProviders,
  isAuthLaunchReady,
} from "@/lib/modules/auth/auth-providers";
import { hydrateEnvFromSettings } from "@/lib/modules/settings/settings-service";

export const dynamic = "force-dynamic";

/** GET /api/auth/providers — الوسائل الظاهرة فعليًا (بدون كشف أسرار). */
export async function GET() {
  await hydrateEnvFromSettings().catch(() => 0);

  return NextResponse.json({
    google: isGoogleSignInAvailable(),
    apple: isAppleSignInAvailable(),
    microsoft: isMicrosoftSignInAvailable(),
    emailCode: isEmailCodeSignInAvailable(),
    phone: isPhoneSignInAvailable(),
    ...getAccountSecurityFeatures(),
    /** كلمة المرور ليست بوابة عامة — تبقى للحقول الداخلية القديمة فقط. */
    password: false,
    providers: listVisibleAuthProviders(),
    launchReady: isAuthLaunchReady(),
  });
}

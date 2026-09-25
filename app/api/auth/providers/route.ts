import { NextResponse } from "next/server";
import {
  isAppleSignInAvailable,
  isGoogleSignInAvailable,
  isMagicLinkPublicEnabled,
  isMicrosoftPublicSignInAvailable,
  isPhoneSignInAvailable,
  listVisibleAuthProviders,
  isAuthLaunchReady,
} from "@/lib/modules/auth/auth-providers";
import { hydrateEnvFromSettings } from "@/lib/modules/settings/settings-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/auth/providers — الوسائل الظاهرة للعامة فقط (بلا أسرار).
 * Microsoft Entra اليدوي وMagic link والهاتف لا تُعلن إلا بأعلام صريحة.
 */
export async function GET() {
  await hydrateEnvFromSettings().catch(() => 0);

  return NextResponse.json({
    google: isGoogleSignInAvailable(),
    apple: isAppleSignInAvailable(),
    microsoft: isMicrosoftPublicSignInAvailable(),
    phone: isPhoneSignInAvailable(),
    magicLink: isMagicLinkPublicEnabled(),
    /** كلمة المرور ظاهرة في /sign-in عبر EmailPasswordSignIn (أساسية). */
    password: true,
    providers: listVisibleAuthProviders(),
    launchReady: isAuthLaunchReady(),
  });
}

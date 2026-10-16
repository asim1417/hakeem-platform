/**
 * إعدادات صندوق الدخول الموحّد — تشترك فيها نافذة الرئيسية وصفحة ‎/sign-in‎
 * (مكوّن واحد وتصميم واحد لكل مداخل الدخول). لا أسرار هنا: المفتاح العام فقط.
 */

import type { HomeAuthConfig } from "@/components/home/HomeAuthLauncher";
import { isIdentifierFormEnabled, listVisibleAuthProviders } from "@/lib/modules/auth/auth-providers";
import { shouldHideClerkDevelopmentModeUi } from "@/lib/modules/auth/owner-emergency";

export function buildHomeAuthConfig(): HomeAuthConfig {
  return {
    providers: listVisibleAuthProviders(),
    identifierForm: isIdentifierFormEnabled(),
    publishableKey: (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "").trim(),
    hideDevelopmentMode: shouldHideClerkDevelopmentModeUi(),
  };
}

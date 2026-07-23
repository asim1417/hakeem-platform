import { ClerkAppProvider } from "@/components/providers/ClerkAppProvider";
import { shouldHideClerkDevelopmentModeUi } from "@/lib/modules/auth/owner-emergency";

/**
 * غلاف Clerk للمسارات التي تحتاجه فقط (دخول / لوحة / إدارة).
 * الصفحة العامة `/` لا تستخدمه — حتى لا يسقط iPhone عند فشل Clerk.
 */
export function ClerkRoot({ children }: { children: React.ReactNode }) {
  const publishableKey = (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "").trim();
  return (
    <ClerkAppProvider
      publishableKey={publishableKey || undefined}
      hideDevelopmentMode={shouldHideClerkDevelopmentModeUi()}
    >
      {children}
    </ClerkAppProvider>
  );
}

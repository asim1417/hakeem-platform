"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { clerkAppearance, clerkLocalization } from "@/lib/modules/auth/clerk-config";
import { ClientErrorBoundary } from "@/components/providers/ClientErrorBoundary";

const AFTER_AUTH = "/auth/continue";

/** يغلّف التطبيق بـ Clerk — عربية + هوية حكيم. */
export function ClerkAppProvider({
  children,
  publishableKey,
  hideDevelopmentMode = false,
}: {
  children: React.ReactNode;
  publishableKey?: string;
  hideDevelopmentMode?: boolean;
}) {
  if (!publishableKey) return <>{children}</>;

  const appearance = hideDevelopmentMode
    ? {
        ...clerkAppearance,
        layout: {
          ...clerkAppearance.layout,
          unsafe_disableDevelopmentModeWarnings: true,
        },
      }
    : clerkAppearance;

  // نستخدم fallback فقط (لا force) لتقليل حلقات التحويل على iOS Safari مع pk_test_
  return (
    <ClientErrorBoundary
      fallback={
        <div dir="rtl" className="grid min-h-[100dvh] place-items-center bg-[#EFF3F2] p-6 text-center">
          <div className="max-w-md rounded-2xl border border-[rgba(14,52,53,0.1)] bg-[#FFFcf7] p-8">
            <p className="text-xl font-bold text-[#0E3435]">حكيم</p>
            <p className="mt-3 text-sm leading-7 text-[rgba(14,52,53,0.65)]">
              تعذّر تحميل نظام الدخول على هذا الجهاز. حدّث الصفحة أو افتح الرابط مباشرة.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <a
                href="/"
                className="inline-flex min-h-[44px] items-center rounded-xl border border-[rgba(14,52,53,0.12)] bg-white px-4 text-sm font-semibold text-[#0E3435]"
              >
                الرئيسية
              </a>
              <a
                href="/sign-in"
                className="inline-flex min-h-[44px] items-center rounded-xl bg-[#0E3435] px-4 text-sm font-semibold text-[#FFFcf7]"
              >
                تسجيل الدخول
              </a>
            </div>
          </div>
        </div>
      }
    >
      <ClerkProvider
        publishableKey={publishableKey}
        appearance={appearance}
        localization={clerkLocalization}
        signInUrl="/sign-in"
        signUpUrl="/sign-up"
        afterSignOutUrl="/sign-in"
        signInFallbackRedirectUrl={AFTER_AUTH}
        signUpFallbackRedirectUrl={AFTER_AUTH}
        telemetry={false}
      >
        {children}
      </ClerkProvider>
    </ClientErrorBoundary>
  );
}

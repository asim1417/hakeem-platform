"use client";

import { useEffect } from "react";
import { AuthGatewayFailCard } from "@/components/auth/AuthGatewayFailCard";

/**
 * أخطاء مسار /sign-in تُحتوى هنا — لا تُرفع إلى global-error.
 */
export default function SignInError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("sign-in error boundary:", error?.message);
  }, [error]);

  return (
    <main className="login-page login-page--compact" lang="ar" dir="rtl">
      <div className="login-panel" style={{ minHeight: "100dvh" }}>
        <div className="flex w-full flex-col items-center justify-center px-4 py-10">
          <AuthGatewayFailCard isSignIn onRetry={reset} />
        </div>
      </div>
    </main>
  );
}

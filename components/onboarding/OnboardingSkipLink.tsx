"use client";

import Link from "next/link";

/** رابط تخطّي يضبط كعكة حتى لا تُعاد الإجبار على /onboarding. */
export function OnboardingSkipLink() {
  return (
    <Link
      href="/dashboard"
      className="focus-ring underline-offset-4 hover:underline"
      onClick={() => {
        document.cookie = "hakeem_onboarding_skipped=1; path=/; max-age=2592000; SameSite=Lax";
      }}
    >
      تخطّي إلى اللوحة لاحقًا
    </Link>
  );
}

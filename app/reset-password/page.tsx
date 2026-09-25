import { Suspense } from "react";
import Link from "next/link";
import { AuthJourneyShell } from "@/components/auth/AuthJourneyShell";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export const metadata = {
  title: "تعيين كلمة مرور جديدة — حكيم",
};

export default function ResetPasswordPage() {
  return (
    <AuthJourneyShell
      compact
      tagline="عيّن كلمة مرور جديدة لحسابك"
      footer={
        <nav className="login-panel__links" aria-label="روابط نظامية">
          <Link href="/">الرئيسية</Link>
          <span aria-hidden>·</span>
          <Link href="/sign-in">تسجيل الدخول</Link>
          <span aria-hidden>·</span>
          <Link href="/forgot-password">طلب رابط جديد</Link>
        </nav>
      }
    >
      <Suspense
        fallback={
          <p className="text-sm text-[rgba(14,52,53,0.6)]" role="status">
            جارٍ التحميل…
          </p>
        }
      >
        <ResetPasswordForm />
      </Suspense>
    </AuthJourneyShell>
  );
}

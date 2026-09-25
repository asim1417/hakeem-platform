import Link from "next/link";
import { AuthJourneyShell } from "@/components/auth/AuthJourneyShell";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export const metadata = {
  title: "استعادة كلمة المرور — حكيم",
};

export default function ForgotPasswordPage() {
  return (
    <AuthJourneyShell
      compact
      tagline="استعد الوصول إلى حسابك بأمان"
      footer={
        <nav className="login-panel__links" aria-label="روابط نظامية">
          <Link href="/">الرئيسية</Link>
          <span aria-hidden>·</span>
          <Link href="/sign-in">تسجيل الدخول</Link>
          <span aria-hidden>·</span>
          <Link href="/privacy">سياسة الخصوصية</Link>
        </nav>
      }
    >
      <ForgotPasswordForm />
    </AuthJourneyShell>
  );
}

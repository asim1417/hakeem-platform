import Link from "next/link";
import { isClerkConfigured } from "@/lib/modules/auth/clerk-config";
import { AuthClerkSignUp } from "@/components/auth/AuthClerkSignUp";
import { AuthJourneyShell } from "@/components/auth/AuthJourneyShell";

export const metadata = {
  title: "إنشاء حساب — حكيم",
};

export default function SignUpPage() {
  const configured = isClerkConfigured();

  return (
    <AuthJourneyShell
      tagline="أنشئ حسابك وادخل مباشرة. الاسم والجوال اختياريان — وإكمال الملف يزيد المكافآت إن رغبت."
      footer={
        <p className="login-panel__links">
          <Link href="/" className="underline-offset-4 hover:underline">
            الرئيسية
          </Link>
          <span aria-hidden> · </span>
          <Link href="/sign-in" className="underline-offset-4 hover:underline">
            لديك حساب؟ سجّل الدخول
          </Link>
        </p>
      }
    >
      {configured ? (
        <AuthClerkSignUp forceRedirectUrl="/auth/continue" />
      ) : (
        <div className="w-full rounded-[var(--r-md)] border border-[var(--amber)]/40 bg-[var(--amber-soft)] px-4 py-3 text-sm leading-7 text-[var(--amber)]">
          اضبط مفاتيح Clerk في Vercel لتفعيل التسجيل.
        </div>
      )}
    </AuthJourneyShell>
  );
}

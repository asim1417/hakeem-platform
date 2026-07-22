import Link from "next/link";
import { isClerkConfigured } from "@/lib/modules/auth/clerk-config";
import { OwnerEmergencyLogin } from "@/components/auth/OwnerEmergencyLogin";
import { AuthClerkSignIn } from "@/components/auth/AuthClerkSignIn";
import { AuthJourneyShell } from "@/components/auth/AuthJourneyShell";

export const metadata = {
  title: "تسجيل الدخول — حكيم",
};

export default function SignInPage({
  searchParams,
}: {
  searchParams?: { setup?: string; next?: string };
}) {
  const configured = isClerkConfigured();
  const nextUrl =
    searchParams?.next && searchParams.next.startsWith("/") && !searchParams.next.startsWith("//")
      ? searchParams.next
      : "/dashboard";

  return (
    <AuthJourneyShell
      tagline={
        configured
          ? "ادخل إلى لوحتك، ثم أدخل الاسم والجوال والمهنة للمتابعة. باقي الملف اختياري للمكافآت."
          : "دخول المالك متاح الآن — Clerk يُضبط لاحقًا."
      }
      footer={
        <p className="login-panel__links">
          <Link href="/" className="underline-offset-4 hover:underline">
            الرئيسية
          </Link>
          <span aria-hidden> · </span>
          <Link href="/sign-up" className="underline-offset-4 hover:underline">
            إنشاء حساب
          </Link>
        </p>
      }
    >
      {!configured ? (
        <div className="w-full rounded-[var(--r-md)] border border-[var(--amber)]/40 bg-[var(--amber-soft)] px-4 py-3 text-sm leading-7 text-[var(--amber)]">
          مفاتيح Clerk غير مضبوطة بعد. استخدم <strong>دخول المالك</strong> بالأسفل للوصول فورًا.
        </div>
      ) : null}

      {configured ? (
        <AuthClerkSignIn nextUrl={nextUrl} routing="path" path="/sign-in" />
      ) : (
        <OwnerEmergencyLogin nextUrl={nextUrl} clerkEnabled={false} />
      )}
    </AuthJourneyShell>
  );
}

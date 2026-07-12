import { redirect } from "next/navigation";
import { LoginForm } from "@/components/LoginForm";
import { LegalAlert } from "@/components/ui/legal";
import { isAuthDisabled } from "@/lib/modules/auth/session";
import { isGoogleOAuthConfigured } from "@/lib/modules/auth/google-oauth";

const OAUTH_ERRORS: Record<string, string> = {
  google_disabled: "دخول Google غير مُفعّل بعد على الخادم.",
  google_denied: "أُلغيت المصادقة من Google.",
  oauth_state: "انتهت صلاحية جلسة الدخول أو تعذّر التحقق — أعد المحاولة.",
  google_profile: "تعذّر جلب بريد الحساب من Google أو أنه غير مُوثّق.",
  oauth_user: "تعذّر تجهيز حساب المستخدم — حاول مرة أخرى.",
};

export default function LoginPage({ searchParams }: { searchParams: { next?: string; error?: string } }) {
  const nextUrl = searchParams?.next && searchParams.next.startsWith("/") ? searchParams.next : "/dashboard";
  // عند تعطيل تسجيل الدخول نخفي الصفحة ونحوّل المستخدم مباشرة إلى لوحة التحكم.
  if (isAuthDisabled()) redirect(nextUrl);
  const oauthError = searchParams?.error ? OAUTH_ERRORS[searchParams.error] : null;
  return (
    <main className="legal-luxury-surface flex min-h-screen items-center justify-center px-5">
      <div className="w-full max-w-md">
        {oauthError ? <div className="mb-4"><LegalAlert tone="danger">{oauthError}</LegalAlert></div> : null}
        <LoginForm nextUrl={nextUrl} googleEnabled={isGoogleOAuthConfigured()} />
        <p className="mt-4 rounded-md border border-[#C09B5A]/25 bg-[#FBF8F1] p-4 text-sm leading-7 text-[#0B1F3A]">
          الدخول محمي بجلسة خادمية وكلمة مرور مشفرة. عند تعطيل المستخدم من الإدارة لن يستطيع تسجيل الدخول.
        </p>
      </div>
    </main>
  );
}

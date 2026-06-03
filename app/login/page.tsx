import { LoginForm } from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <main className="legal-luxury-surface flex min-h-screen items-center justify-center px-5">
      <div className="w-full max-w-md">
        <LoginForm />
        <p className="mt-4 rounded-md border border-[#C09B5A]/25 bg-[#FBF8F1] p-4 text-sm leading-7 text-[#0B1F3A]">
          الدخول محمي بجلسة خادمية وكلمة مرور مشفرة. عند تعطيل المستخدم من الإدارة لن يستطيع تسجيل الدخول.
        </p>
      </div>
    </main>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { requireUser } from "@/lib/modules/auth/session";
import { getProfile } from "@/lib/modules/onboarding/profile";
import { getBalance } from "@/lib/modules/credits/ledger";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "إكمال الملف — حكيم",
  description: "أكمل ملفك المهني واكسب نقاط حكيم.",
};

export default async function OnboardingPage() {
  const user = await requireUser();
  if (user.email === "guest@hakeem.local") {
    redirect("/dashboard");
  }

  const profile = await getProfile(user.id);
  const balance = profile.unknown ? 0 : await getBalance(user.id);

  // إن اكتمل الملف مسبقًا يمكن إعادة الزيارة للمراجعة دون إجبار.
  return (
    <main className="login-page">
      <div aria-hidden className="login-page__glow" />
      <div aria-hidden className="login-page__pattern" />

      <div className="login-page__grid">
        <aside className="login-brand">
          <div className="login-brand__inner">
            <p className="login-brand__mark" aria-hidden>
              ح
            </p>
            <h1 className="login-brand__title">حكيم</h1>
            <p className="login-brand__tagline">
              أكمل ملفك لتحصل على نقاط إضافية وتجربة مخصّصة لتخصصك.
            </p>
            <ul className="login-brand__points">
              <li>+500 نقطة ترحيبية عند التسجيل</li>
              <li>مكافآت لكل خطوة تُكملها</li>
              <li>دعوة زملاء برمز إحالة خاص بك</li>
            </ul>
          </div>
        </aside>

        <section className="login-panel" aria-labelledby="onboarding-heading">
          <div className="login-panel__card">
            <h2 id="onboarding-heading" className="absolute h-px w-px overflow-hidden whitespace-nowrap p-0 [clip:rect(0,0,0,0)]">
              إكمال الملف
            </h2>
            <OnboardingWizard
              userName={user.name}
              initialStep={profile.onboardingCompleted ? 1 : Math.min(6, Math.max(1, profile.onboardingStep || 1))}
              initialBalance={balance}
            />
            <p className="login-panel__links mt-6">
              <Link href="/dashboard" className="focus-ring underline-offset-4 hover:underline">
                تخطّي إلى اللوحة لاحقًا
              </Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

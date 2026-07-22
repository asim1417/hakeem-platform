import { redirect } from "next/navigation";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { OnboardingSkipLink } from "@/components/onboarding/OnboardingSkipLink";
import { AuthJourneyShell } from "@/components/auth/AuthJourneyShell";
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

  return (
    <AuthJourneyShell
      tagline="أكمل ملفك لتحصل على نقاط إضافية وتجربة مخصّصة لتخصصك."
      points={[
        "+500 نقطة ترحيبية عند التسجيل",
        "مكافآت لكل خطوة تُكملها",
        "دعوة زملاء برمز إحالة خاص بك",
      ]}
      footer={
        <p className="login-panel__links">
          <OnboardingSkipLink />
        </p>
      }
    >
      <h2 className="absolute h-px w-px overflow-hidden whitespace-nowrap p-0 [clip:rect(0,0,0,0)]">
        إكمال الملف
      </h2>
      <div className="w-full">
        <OnboardingWizard
          userName={user.name}
          initialStep={
            profile.onboardingCompleted ? 1 : Math.min(6, Math.max(1, profile.onboardingStep || 1))
          }
          initialBalance={balance}
        />
      </div>
    </AuthJourneyShell>
  );
}

import Link from "next/link";
import { getCurrentUser } from "@/lib/modules/auth/session";
import { getProfile, needsEssentials, needsOnboarding } from "@/lib/modules/onboarding/profile";

/** تذكير اختياري بالمكافآت بعد اكتمال البيانات الأساسية. */
export async function OnboardingBanner() {
  const user = await getCurrentUser().catch(() => null);
  if (!user || user.email === "guest@hakeem.local") return null;

  const profile = await getProfile(user.id);
  if (needsEssentials(user, profile)) return null;
  if (!needsOnboarding(profile, user.email)) return null;

  return (
    <section
      dir="rtl"
      className="mb-6 rounded-[var(--r-lg)] border border-[var(--gold-border)] bg-[var(--gold-ghost)] px-5 py-4"
      aria-label="مكافآت اختيارية"
    >
      <p className="text-sm font-semibold text-[var(--navy)]">هل تريد الاستفادة الأفضل من الرصيد؟</p>
      <p className="mt-1 text-sm leading-7 text-[var(--ink-60)]">
        بياناتك الأساسية مكتملة. إكمال باقي الملف اختياري ويزيد المكافآت والإحالة.
      </p>
      <Link
        href="/onboarding"
        className="mt-3 inline-flex rounded-[var(--r-md)] bg-[var(--navy)] px-4 py-2 text-sm font-semibold text-[var(--cream)] hover:bg-[#164849]"
      >
        إكمال الملف للمكافآت
      </Link>
    </section>
  );
}

import Link from "next/link";
import { getCurrentUser } from "@/lib/modules/auth/session";
import { getProfile, needsOnboarding } from "@/lib/modules/onboarding/profile";
import { cookies } from "next/headers";

/** شريط تذكير في اللوحة إن لم يُكمل الملف — بنفس لغة نقاط حكيم. */
export async function OnboardingBanner() {
  const user = await getCurrentUser().catch(() => null);
  if (!user || user.email === "guest@hakeem.local") return null;

  const profile = await getProfile(user.id);
  if (!needsOnboarding(profile, user.email)) return null;

  const skipped = cookies().get("hakeem_onboarding_skipped")?.value === "1";

  return (
    <section
      dir="rtl"
      className="mb-6 rounded-[var(--r-lg)] border border-[var(--gold-border)] bg-[var(--gold-ghost)] px-5 py-4"
      aria-label="إكمال الملف"
    >
      <p className="text-sm font-semibold text-[var(--navy)]">
        {skipped ? "أكمل ملفك لاحقًا واكسب نقاطًا إضافية" : "خطوة واحدة تفصلك عن تجربة مخصّصة"}
      </p>
      <p className="mt-1 text-sm leading-7 text-[var(--ink-60)]">
        إكمال الملف يفعّل المكافآت والإحالة ويضبط تخصصك في البحث والتحليل.
      </p>
      <Link
        href="/onboarding"
        className="mt-3 inline-flex rounded-[var(--r-md)] bg-[var(--navy)] px-4 py-2 text-sm font-semibold text-[var(--cream)] hover:bg-[#164849]"
      >
        متابعة إكمال الملف
      </Link>
    </section>
  );
}

import Link from "next/link";
import { getCurrentUser } from "@/lib/modules/auth/session";
import { getCreditsStatus } from "@/lib/modules/credits/ledger";
import { getReferralInfo } from "@/lib/modules/referrals/codes";
import { CREDIT_USES } from "@/config/credits";

/** ويدجت رصيد النقاط + رابط الإحالة — يظهر في لوحة التحكم. */
export async function CreditsWidget() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return null;

  const status = await getCreditsStatus(user.id).catch(() => null);
  if (!status || status.unknown) return null;

  const referral = await getReferralInfo(user.id).catch(() => null);
  const ar = (n: number) => n.toLocaleString("ar-SA");

  return (
    <section
      dir="rtl"
      className="mb-6 grid gap-4 rounded-[var(--r-lg)] border border-[var(--gold-border)] bg-[linear-gradient(135deg,var(--navy)_0%,#164849_55%,var(--navy)_100%)] p-5 text-white sm:grid-cols-[1.2fr_1fr]"
      aria-label="رصيد النقاط والإحالة"
    >
      <div>
        <p className="text-xs font-semibold tracking-wide text-[var(--gold)]">نقاط حكيم</p>
        <p className="mt-2 font-display text-4xl tabular-nums">{ar(status.balance)}</p>
        <p className="mt-2 text-sm leading-7 text-white/75">
          أكمل ملفك وادعُ زملاءك. استخدم النقاط لتحميل الأحكام أو تجاوز الحصّة المجانية عند النفاد.
        </p>
        <ul className="mt-3 space-y-1 text-xs text-white/65">
          {CREDIT_USES.slice(0, 3).map((u) => (
            <li key={u.points}>
              {ar(u.points)} نقطة — {u.label}
            </li>
          ))}
        </ul>
        <Link
          href="/onboarding"
          className="mt-4 inline-block text-sm font-semibold text-[var(--gold)] underline-offset-4 hover:underline"
        >
          مراجعة الملف / الإكمال
        </Link>
      </div>

      <div className="rounded-[var(--r-md)] border border-white/15 bg-white/5 p-4">
        <p className="text-xs font-semibold text-[var(--gold)]">دعوة زميل</p>
        <p className="mt-2 text-sm leading-7 text-white/80">
          شارك رمزك واحصل على +300 نقطة عند تسجيله، وهو يحصل على +200.
        </p>
        {referral?.code ? (
          <>
            <p dir="ltr" className="mt-3 rounded-md bg-black/20 px-3 py-2 text-center font-mono text-lg tracking-wider text-[var(--gold)]">
              {referral.code}
            </p>
            <p dir="ltr" className="mt-2 break-all text-center text-[11px] text-white/50">
              {referral.link}
            </p>
          </>
        ) : (
          <p className="mt-3 text-xs text-white/50">رمز الإحالة غير جاهز بعد — أكمل الهجرة أو أعد المحاولة.</p>
        )}
      </div>
    </section>
  );
}

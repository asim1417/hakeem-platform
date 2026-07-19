import Link from "next/link";
import { getCurrentUser } from "@/lib/modules/auth/session";
import { getStatus } from "@/lib/modules/billing/quota";
import { PRICING } from "@/config/pricing";

// عدّاد الحصّة المجانية — شارةٌ أعلى الوحدات المتقدّمة. الحالة من الخادم لا من تخزين المتصفّح.
// يختفي للمشتركين وقبل تطبيق الهجرة (unknown). يحمل تحذيرًا لطيفًا قرب النفاد.
export async function QuotaCounter() {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return null;
  const s = await getStatus(user.id).catch(() => null);
  if (!s || s.unknown || s.isSubscribed) return null;

  const ar = (n: number) => n.toLocaleString("ar-SA");
  const exhausted = s.remaining <= 0;
  const warn = !exhausted && s.remaining <= PRICING.warnAt;

  return (
    <div
      dir="rtl"
      className={`mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[var(--r-lg)] border px-4 py-2.5 text-sm ${
        exhausted
          ? "border-[rgba(140,34,51,0.3)] bg-[var(--ruby-soft)] text-[var(--ruby)]"
          : warn
            ? "border-amber-300 bg-amber-50 text-amber-800"
            : "border-line bg-[var(--surface)] text-[var(--petrol)]"
      }`}
    >
      <span className="font-semibold">
        {exhausted
          ? "انتهى رصيدك المجانيّ للوحدات المتقدّمة."
          : `متبقٍّ لك ${ar(s.remaining)} من ${ar(s.total)} استخدامًا مجانيًّا${warn ? " — يقترب من النفاد" : ""}`}
      </span>
      {exhausted || warn ? (
        <Link
          href="/dashboard/subscribe"
          className="focus-ring shrink-0 rounded-[var(--r-md)] bg-[var(--petrol)] px-4 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"
        >
          عرض خطط الاشتراك
        </Link>
      ) : null}
    </div>
  );
}

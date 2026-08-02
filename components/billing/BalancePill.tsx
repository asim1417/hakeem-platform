import Link from "next/link";
import { getWalletSummary } from "@/lib/modules/billing/credit-engine";

// شارة الرصيد المضغوطة — تُعرض أعلى الواجهة وتربط لصفحة المحفظة.
// مكوّن خادميّ: يقرأ المحفظة مباشرة. يختفي إذا لم تُفعَّل النقاط.
// حالة تنبيه لطيفة عند اقتراب الرصيد من النفاد (< 50 نقطة).

const LOW_BALANCE_THRESHOLD = 50;

export async function BalancePill({ userId }: { userId: string }) {
  const summary = await getWalletSummary(userId).catch(() => null);
  if (!summary || !summary.enabled) return null;

  const available = Math.max(0, Math.floor(summary.availablePoints));
  const low = available < LOW_BALANCE_THRESHOLD;
  const ar = available.toLocaleString("ar-SA");

  return (
    <Link
      href="/dashboard/account/billing"
      dir="rtl"
      aria-label={`رصيدك ${ar} نقطة — عرض المحفظة`}
      className={`focus-ring inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition ${
        low
          ? "border-[rgba(140,34,51,0.35)] bg-[var(--ruby-soft)] text-[var(--ruby)]"
          : "border-[var(--gold-border)] bg-[var(--gold)] text-[var(--navy)]"
      }`}
    >
      <span className="font-mono-legal">{ar}</span>
      <span>نقطة</span>
    </Link>
  );
}

export default BalancePill;

import Link from "next/link";
import type { QuotaStatus } from "@/lib/modules/billing/quota";
import { PRICING } from "@/config/pricing";

export function BillingStatusCard({
  status,
  userName,
}: {
  status: QuotaStatus;
  userName?: string;
}) {
  const ar = (n: number) => n.toLocaleString("ar-SA");

  if (status.unknown) {
    return (
      <section className="rounded-[var(--r-xl)] border border-[var(--ink-08)] bg-ivory p-5">
        <h2 className="font-display-ar text-lg font-bold text-[var(--navy)]">حالة الاشتراك</h2>
        <p className="mt-2 text-sm leading-7 text-[var(--ink-60)]">
          عدّاد الحصّة غير مفعّل بعد على قاعدة البيانات — الاستخدام مفتوح حاليًا. عند تفعيل أعمدة الحصّة يظهر الرصيد هنا.
        </p>
      </section>
    );
  }

  const planLabel = status.isSubscribed ? "محامٍ محترف (نشط)" : "تجربة مجانية";
  const pct = status.total > 0 ? Math.min(100, Math.round((status.used / status.total) * 100)) : 0;

  return (
    <section className="rounded-[var(--r-xl)] border border-[var(--gold-border)] bg-ivory p-5 shadow-[var(--sh-xs)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-[var(--gold-dark)]">حسابك</p>
          <h2 className="mt-1 font-display-ar text-xl font-bold text-[var(--navy)]">
            {userName ? `${userName} · ` : ""}
            {planLabel}
          </h2>
        </div>
        <Link
          href="/dashboard/subscribe"
          className="focus-ring rounded-[var(--r-md)] border border-[var(--gold-border)] bg-[var(--gold-ghost)] px-4 py-2 text-xs font-semibold text-[var(--navy)]"
        >
          عرض الخطط
        </Link>
      </div>

      {status.isSubscribed ? (
        <p className="mt-4 text-sm leading-7 text-[var(--ink-70)]">
          اشتراكك نشط — الوحدات المتقدّمة بلا حد استخدام. تصفّح النواة القانونية مجاني دائمًا.
        </p>
      ) : (
        <>
          <div className="mt-5">
            <div className="mb-2 flex justify-between text-sm text-[var(--ink-70)]">
              <span>
                استُخدم {ar(status.used)} من {ar(status.total)}
              </span>
              <span className="font-semibold text-[var(--navy)]">متبقٍّ {ar(status.remaining)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[var(--hakeem-bg-soft)]">
              <div
                className="h-full rounded-full bg-[var(--navy)] transition-all"
                style={{ width: `${pct}%` }}
                aria-hidden
              />
            </div>
          </div>
          {status.remaining <= PRICING.warnAt ? (
            <p className="mt-3 text-sm leading-7 text-[var(--amber)]">
              رصيدك يقترب من النفاد — عند النفاد تُطلب خطط الاشتراك للوحدات المتقدّمة فقط.
            </p>
          ) : (
            <p className="mt-3 text-sm leading-7 text-[var(--ink-60)]">
              الحصّة للمجانية تشمل: اسأل حكيم · الاستشارات · القاضي التفاعلي. البحث في النواة بلا حد.
            </p>
          )}
        </>
      )}
    </section>
  );
}

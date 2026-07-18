import Link from "next/link";
import { requirePagePermission } from "@/lib/modules/auth/session";
import { getCurrentUser } from "@/lib/modules/auth/session";
import { getStatus } from "@/lib/modules/billing/quota";
import { PRICING } from "@/config/pricing";

export const dynamic = "force-dynamic";

// صفحة الخطط — مؤقّتة (المرحلة الأولى). الأرقام من config/pricing.ts فقط، لا رقم مبعثر.
// خطط الدفع (Moyasar) والدورة الكاملة مرحلةٌ لاحقة يضبط أرقامَها المالك.
export default async function SubscribePage() {
  await requirePagePermission("LEGAL_CORE_VIEW");
  const user = await getCurrentUser().catch(() => null);
  const status = user ? await getStatus(user.id).catch(() => null) : null;
  const ar = (n: number) => n.toLocaleString("ar-SA");

  return (
    <div dir="rtl" className="mx-auto max-w-3xl">
      <header className="hero">
        <p className="text-sm text-[var(--gold-pale)]">الاشتراك</p>
        <h1 className="t-display mt-2 text-3xl font-bold md:text-4xl">خطط حكيم</h1>
        <p className="mt-3 max-w-2xl leading-8 text-white/85">
          الوحدات المتقدّمة (اسأل حكيم · القاضي التفاعليّ · الاستشارات) تُتاح بحصّةٍ مجانيةٍ عند التسجيل، ثم بالاشتراك. تصفّح النواة القانونية يبقى مجانيًّا دائمًا.
        </p>
      </header>

      {status && !status.unknown && !status.isSubscribed ? (
        <div className="mt-6 rounded-[var(--r-lg)] border border-line bg-[var(--surface)] p-4 text-sm text-[var(--petrol)]">
          رصيدك المجانيّ: <strong>{ar(status.remaining)}</strong> متبقٍّ من {ar(status.total)} استخدامًا.
        </div>
      ) : null}

      <section className="mt-6 rounded-[var(--r-xl)] border border-line bg-ivory p-6 shadow-sm">
        <h2 className="text-xl font-bold text-[var(--petrol)]">الحصّة المجانية</h2>
        <p className="mt-2 leading-7 text-[var(--muted)]">
          كل حسابٍ جديد يحصل على <strong>{ar(PRICING.freeQuota)}</strong> استخدامًا مجانيًّا للوحدات المتقدّمة. عند اقترابها من النفاد ننبّهك، وعند نفادها تظهر خطط الاشتراك.
        </p>
        <div className="mt-5 rounded-[var(--r-lg)] border border-dashed border-[var(--copper)] bg-[var(--copper-soft)] p-4 text-sm leading-7 text-[var(--copper-deep)]">
          خطط الاشتراك المدفوعة (الشهرية/السنوية عبر الدفع السعوديّ) قيد التجهيز — تُفعَّل بأسعارٍ يعتمدها فريق حكيم. سنُعلمك فور توفّرها.
        </div>
        <Link
          href="/dashboard"
          className="focus-ring mt-5 inline-block rounded-[var(--r-md)] bg-[var(--petrol)] px-6 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
        >
          العودة إلى لوحة التحكم
        </Link>
      </section>
    </div>
  );
}

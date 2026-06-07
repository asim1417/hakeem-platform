import Link from "next/link";
import { requirePagePermission } from "@/lib/modules/auth/session";

export const dynamic = "force-dynamic";

export default async function SimulationsPage() {
  const user = await requirePagePermission("SIMULATIONS_USE");

  return (
    <div className="flex min-h-[calc(100vh-7rem)] flex-col gap-3">
      <section className="rounded-[var(--r-xl)] border border-[var(--gold-border)] bg-[var(--paper)] p-4 shadow-[var(--sh-xs)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="t-head text-sm font-semibold text-[var(--gold-dark)]">منصة حكيم</p>
            <h1 className="t-head mt-1 text-2xl font-bold text-[var(--navy)]">القاضي التفاعلي</h1>
            <p className="mt-1 max-w-3xl text-sm leading-7 text-[var(--ink-60)]">
              القاضي التفاعلي لحكيم: قاعة مرافعة افتراضية، توليد أحكام مسبَّبة مستندة إلى النواة القانونية، وطرق الاعتراض (استئناف/نقض/التماس) — مدمج في أصل المنصة.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-[var(--gold-border)] bg-white px-3 py-2 text-xs text-[var(--ink-60)]">
              المستخدم الحالي: {user.name} · {user.role}
            </span>
            <a className="btn btn-gold" href="/original-hakeem/hakim1111.html" target="_blank" rel="noreferrer">
              فتح في تبويب مستقل
            </a>
            <Link className="btn btn-outline" href="/dashboard">
              العودة للوحة التحكم
            </Link>
          </div>
        </div>
        <div className="mt-3 rounded-[var(--r-lg)] border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-7 text-amber-900">
          تنبيه: تستخدم النسخة الأصلية إعدادات مزود الذكاء الاصطناعي داخل المتصفح عند تشغيلها كما هي. لا تدخل مفاتيح حساسة في جهاز مشترك.
          تم تجهيز بوابة خلفية آمنة لاحقًا عبر <span dir="ltr">/api/original-hakeem/ai</span> دون تعديل الملف الأصلي.
        </div>
      </section>

      <section className="min-h-[760px] flex-1 overflow-hidden rounded-[var(--r-xl)] border border-[var(--gold-border)] bg-white shadow-[var(--sh-sm)]">
        <iframe
          title="القاضي التفاعلي — حكيم"
          src="/original-hakeem/hakim1111.html"
          className="h-[82vh] min-h-[760px] w-full border-0 bg-white"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
        />
      </section>
    </div>
  );
}

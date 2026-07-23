import { HomeAuthActions } from "@/components/home/HomeAuthActions";

const FEATURES = [
  {
    title: "اسأل حكيم",
    desc: "تحليل واقعة واقتراح أساس نظامي",
    href: "/sign-up?next=%2Fdashboard%2Fask",
  },
  {
    title: "المعاون القضائي",
    desc: "مساحة قضية وتحليل متكامل",
    href: "/sign-up?next=%2Fdashboard%2Fjudicial-assistant",
  },
  {
    title: "محاكاة قضائية",
    desc: "تدريب على تفكير القاضي",
    href: "/sign-up?next=%2Fdashboard%2Fsimulations",
  },
] as const;

/**
 * الصفحة الرئيسية — Server Component ثابت.
 * روابط الدخول عبر <a> عادية (بلا prefetch) حتى لا يُحمَّل Clerk مبكرًا على iPhone.
 */
export function HomeHero() {
  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-[var(--hakeem-bg)]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[480px] opacity-[0.07]"
        style={{
          background:
            "radial-gradient(55% 90% at 50% 0%, var(--navy) 0%, transparent 70%), radial-gradient(35% 70% at 85% 10%, var(--gold) 0%, transparent 65%)",
        }}
      />

      <header className="relative mx-auto flex max-w-6xl items-center justify-between gap-3 px-6 py-5">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-[var(--r-md)] bg-[var(--navy)] font-judicial text-xl font-bold text-[var(--gold-bright)]">
            ح
          </span>
          <div className="leading-tight">
            <p className="text-lg font-bold text-[var(--navy)]">حكيم</p>
            <p className="text-[11px] text-[var(--ink-60)]">منصة المعرفة القضائية</p>
          </div>
        </div>

        <HomeAuthActions
          guest={
            <div className="flex items-center gap-2">
              <a
                href="/sign-in"
                className="focus-ring inline-flex min-h-[44px] items-center gap-2 rounded-[var(--r-md)] border border-[var(--gold-border)] bg-ivory px-4 py-2.5 text-sm font-semibold text-[var(--navy)]"
              >
                تسجيل الدخول
              </a>
              <a
                href="/sign-up"
                className="focus-ring inline-flex min-h-[44px] items-center gap-2 rounded-[var(--r-md)] bg-[var(--navy)] px-4 py-2.5 text-sm font-semibold text-white"
              >
                سجّل مجانًا
              </a>
            </div>
          }
          user={
            <a
              href="/dashboard"
              className="focus-ring inline-flex min-h-[44px] items-center gap-2 rounded-[var(--r-md)] border border-[var(--gold-border)] bg-ivory px-5 py-2.5 text-sm font-semibold text-[var(--navy)]"
            >
              لوحة التحكم
            </a>
          }
        />
      </header>

      <section className="relative mx-auto flex max-w-3xl flex-col items-center px-6 pt-[7vh] pb-16 text-center">
        <p className="mb-4 font-judicial text-sm font-semibold text-[var(--gold-dark)]">حكيم</p>
        <h1 className="font-judicial text-4xl font-bold leading-tight text-[var(--navy)] md:text-6xl">
          رفيق المحامي في القاعة
        </h1>
        <p className="mt-4 max-w-xl text-base leading-8 text-[var(--ink-60)] md:text-lg">
          حلّل الوقائع، اقترح الدفوع، وتابع أعمالك القانونية من مكان واحد — بمصدر نظامي موثّق.
        </p>

        <HomeAuthActions
          guest={
            <div className="mt-8 flex w-full max-w-md flex-col gap-3 sm:flex-row sm:justify-center">
              <a
                href="/sign-up"
                className="focus-ring inline-flex min-h-[48px] flex-1 items-center justify-center rounded-[var(--r-md)] bg-[var(--navy)] px-6 py-3.5 text-base font-semibold text-white shadow-[var(--sh-sm)] transition hover:bg-[var(--navy-mid)]"
              >
                ابدأ مجانًا
              </a>
              <a
                href="/sign-in"
                className="focus-ring inline-flex min-h-[48px] flex-1 items-center justify-center rounded-[var(--r-md)] border border-[var(--gold-border)] bg-ivory px-6 py-3.5 text-base font-semibold text-[var(--navy)] transition hover:border-[var(--gold)]"
              >
                لدي حساب — دخول
              </a>
            </div>
          }
          user={
            <div className="mt-8 flex w-full max-w-md flex-col gap-3 sm:flex-row sm:justify-center">
              <a
                href="/dashboard"
                className="focus-ring inline-flex min-h-[48px] flex-1 items-center justify-center rounded-[var(--r-md)] bg-[var(--navy)] px-6 py-3.5 text-base font-semibold text-white"
              >
                المتابعة إلى المنصة
              </a>
              <a
                href="/dashboard/ask"
                className="focus-ring inline-flex min-h-[48px] flex-1 items-center justify-center rounded-[var(--r-md)] border border-[var(--gold-border)] bg-ivory px-6 py-3.5 text-base font-semibold text-[var(--navy)]"
              >
                اسأل حكيم
              </a>
            </div>
          }
        />

        <p className="mt-4 text-sm text-[var(--ink-40)]">
          الدخول عبر Google أو Apple — بلا تعقيد، وبياناتك محمية.
        </p>

        <ul className="mt-12 grid w-full gap-3 text-right sm:grid-cols-3">
          {FEATURES.map((f) => (
            <li key={f.title}>
              <a
                href={f.href}
                className="focus-ring block w-full rounded-[var(--r-lg)] border border-[var(--ink-08)] bg-ivory/90 px-4 py-4 text-start transition hover:border-[var(--gold-border)] hover:shadow-[var(--sh-xs)]"
              >
                <p className="font-semibold text-[var(--navy)]">{f.title}</p>
                <p className="mt-1 text-xs leading-6 text-[var(--ink-60)]">{f.desc}</p>
                <p className="mt-2 text-[11px] font-semibold text-[var(--gold-dark)]">سجّل للمتابعة ←</p>
              </a>
            </li>
          ))}
        </ul>

        <p className="mx-auto mt-12 max-w-xl text-xs leading-7 text-[var(--ink-40)]">
          تنبيه مهني: مخرجات الذكاء الاصطناعي في حكيم مساعدة وتعليمية ولا تُعدّ رأيًا قانونيًا نهائيًا أو
          حكمًا فعليًا.
        </p>
      </section>
    </main>
  );
}

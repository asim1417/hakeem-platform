import { HomeAuthActions } from "@/components/home/HomeAuthActions";
import { AuthOauthButtons } from "@/components/auth/AuthOauthButtons";
import { isClerkConfigured } from "@/lib/modules/auth/clerk-config";
import { buildOAuthStartPath } from "@/lib/modules/auth/clerk-oauth-start";

const FEATURES = [
  {
    title: "اسأل حكيم",
    desc: "تحليل واقعة واقتراح أساس نظامي",
    next: "/dashboard/ask",
  },
  {
    title: "المعاون القضائي",
    desc: "مساحة قضية وتحليل متكامل",
    next: "/dashboard/judicial-assistant",
  },
  {
    title: "محاكاة قضائية",
    desc: "تدريب على تفكير القاضي",
    next: "/dashboard/simulations",
  },
] as const;

/**
 * الصفحة الرئيسية — لوحة الدخول مضمّنة هنا (بلا انتقال إلى /sign-in).
 * أزرار Google/Apple عبر SSR → /api/auth/oauth/start (بلا Clerk JS على الجهاز).
 */
export function HomeHero() {
  const clerkReady = isClerkConfigured();

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
            <a
              href="#login"
              className="focus-ring inline-flex min-h-[44px] items-center gap-2 rounded-[var(--r-md)] border border-[var(--gold-border)] bg-ivory px-4 py-2.5 text-sm font-semibold text-[var(--navy)]"
            >
              تسجيل الدخول
            </a>
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

      <section className="relative mx-auto flex max-w-3xl flex-col items-center px-6 pt-[5vh] pb-16 text-center">
        <p className="mb-4 font-judicial text-sm font-semibold text-[var(--gold-dark)]">حكيم</p>
        <h1 className="font-judicial text-4xl font-bold leading-tight text-[var(--navy)] md:text-6xl">
          رفيق المحامي في القاعة
        </h1>
        <p className="mt-4 max-w-xl text-base leading-8 text-[var(--ink-60)] md:text-lg">
          حلّل الوقائع، اقترح الدفوع، وتابع أعمالك القانونية من مكان واحد — بمصدر نظامي موثّق.
        </p>

        <HomeAuthActions
          guest={
            <div className="mt-8 flex w-full flex-col items-center">
              {clerkReady ? (
                <AuthOauthButtons mode="sign-in" nextUrl="/dashboard" id="login" embedded />
              ) : (
                <div
                  id="login"
                  className="w-full max-w-[25rem] rounded-[0.75rem] border border-[rgba(14,52,53,0.08)] bg-[#FFFcf7] p-6 text-center"
                >
                  <p className="font-semibold text-[#0E3435]">تسجيل الدخول غير متاح مؤقتًا</p>
                </div>
              )}
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

        <ul className="mt-12 grid w-full gap-3 text-right sm:grid-cols-3">
          {FEATURES.map((f) => (
            <li key={f.title}>
              <a
                href={
                  clerkReady
                    ? buildOAuthStartPath({
                        provider: "google",
                        nextUrl: f.next,
                        mode: "sign-up",
                      })
                    : "#login"
                }
                className="focus-ring block w-full rounded-[var(--r-lg)] border border-[var(--ink-08)] bg-ivory/90 px-4 py-4 text-start transition hover:border-[var(--gold-border)] hover:shadow-[var(--sh-xs)]"
              >
                <p className="font-semibold text-[var(--navy)]">{f.title}</p>
                <p className="mt-1 text-xs leading-6 text-[var(--ink-60)]">{f.desc}</p>
                <p className="mt-2 text-[11px] font-semibold text-[var(--gold-dark)]">
                  ادخل للمتابعة ←
                </p>
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

import { HomeAuthActions, HomeAuthUserName } from "@/components/home/HomeAuthActions";
import { GuestAskComposer } from "@/components/home/GuestAskComposer";
import { HomeAuthLauncher, type HomeAuthConfig } from "@/components/home/HomeAuthLauncher";
import { HomeInlineAskLazy } from "@/components/home/HomeInlineAskLazy";
import {
  hasAnySignInProvider,
  isIdentifierFormEnabled,
  listVisibleAuthProviders,
} from "@/lib/modules/auth/auth-providers";
import { shouldHideClerkDevelopmentModeUi } from "@/lib/modules/auth/owner-emergency";
import { signUpWithNext } from "@/lib/modules/auth/safe-next";
import { isAskFirstHomeEnabled } from "@/lib/modules/config/ask-first-home";
import { isHomeInlineAuthEnabled } from "@/lib/modules/config/home-inline-auth";
import {
  DEFAULT_HOME,
  type SiteHomeContent,
} from "@/lib/modules/site/defaults";

type HomeAuthLinkAttrs = {
  "data-home-auth"?: "login" | "ask" | "navigate";
  "data-home-auth-mode"?: "sign-in" | "sign-up";
  "data-home-auth-next"?: string;
};

/**
 * الصفحة الرئيسية العامة — بلا Clerk وبلا OAuth في الحزمة الأولى.
 * عند ASK_FIRST_HOME: جوهر الصفحة صندوق «اسأل حكيم» للزائر.
 * عند HOME_INLINE_AUTH_ENABLED (افتراضيًا): روابط الدخول تفتح حوارًا داخل الصفحة
 * عبر HomeAuthLauncher، وتبقى <a href> حقيقية لمن لا يعمل عنده JavaScript.
 */
export function HomeHero({
  content = DEFAULT_HOME,
}: {
  content?: SiteHomeContent;
}) {
  const authReady = hasAnySignInProvider();
  const home = content;
  const features =
    home.features?.length > 0 ? home.features : DEFAULT_HOME.features;
  const askFirst = isAskFirstHomeEnabled();
  const inlineAuth = authReady && isHomeInlineAuthEnabled();
  const authConfig: HomeAuthConfig | null = inlineAuth
    ? {
        providers: listVisibleAuthProviders(),
        identifierForm: isIdentifierFormEnabled(),
        publishableKey: (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "").trim(),
        hideDevelopmentMode: shouldHideClerkDevelopmentModeUi(),
      }
    : null;
  /** سمات الاعتراض — فارغة تمامًا عند إطفاء الراية (الروابط كما كانت). */
  const authLink = (
    kind: "login" | "navigate",
    mode: "sign-in" | "sign-up",
    next?: string
  ): HomeAuthLinkAttrs =>
    inlineAuth
      ? {
          "data-home-auth": kind,
          "data-home-auth-mode": mode,
          ...(next ? { "data-home-auth-next": next } : {}),
        }
      : {};
  const launcher = authConfig ? <HomeAuthLauncher config={authConfig} /> : null;
  // الشريط عند تفعيل الحوار: «ابدأ مجانًا» أساسي + «دخول» نصّي (زر واحد على الجوال)
  const inlineGuestBar = (
    <div className="flex items-center gap-1 sm:gap-2">
      <a
        href="/sign-in"
        {...authLink("login", "sign-in")}
        aria-label="تسجيل الدخول"
        className="focus-ring hidden min-h-[44px] items-center px-3 text-sm font-semibold text-[var(--navy)] underline-offset-4 hover:underline sm:inline-flex"
      >
        دخول
      </a>
      <a
        href="/sign-up"
        {...authLink("login", "sign-up")}
        className="focus-ring inline-flex min-h-[44px] items-center gap-2 rounded-[var(--r-md)] bg-[var(--navy)] px-4 py-2.5 text-sm font-semibold text-white"
      >
        ابدأ مجانًا
      </a>
    </div>
  );
  const inlineUserBar = (
    <a
      id="home-account-link"
      href="/dashboard"
      className="focus-ring inline-flex min-h-[44px] items-center gap-2 rounded-[var(--r-md)] bg-[var(--navy)] px-5 py-2.5 text-sm font-semibold text-white"
    >
      <HomeAuthUserName fallback="المتابعة إلى المنصة" />
    </a>
  );

  if (askFirst) {
    return (
      <main className="relative min-h-[100dvh] overflow-hidden bg-[var(--hakeem-bg)]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[520px] opacity-[0.08]"
          style={{
            background:
              "radial-gradient(55% 90% at 50% 0%, var(--navy) 0%, transparent 70%), radial-gradient(35% 70% at 85% 10%, var(--gold) 0%, transparent 65%)",
          }}
        />

        <header className="relative mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-5">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-[var(--r-md)] bg-[var(--navy)] font-judicial text-xl font-bold text-[var(--gold-bright)]">
              ح
            </span>
            <div className="leading-tight">
              <p className="text-lg font-bold text-[var(--navy)]">{home.brandName}</p>
              <p className="text-[11px] text-[var(--ink-60)]">{home.tagline}</p>
            </div>
          </div>

          <nav className="hidden items-center gap-4 text-sm font-semibold text-[var(--navy)] md:flex" aria-label="التنقل العام">
            <a href="#ask" className="hover:text-[var(--gold-dark)]">
              اسأل حكيم
            </a>
            <a href="#services" className="hover:text-[var(--gold-dark)]">
              الخدمات
            </a>
            <a href="#trust" className="hover:text-[var(--gold-dark)]">
              لماذا حكيم
            </a>
            <a href="/pricing" className="hover:text-[var(--gold-dark)]">
              الأسعار
            </a>
          </nav>

          {inlineAuth ? (
            <HomeAuthActions guest={inlineGuestBar} user={inlineUserBar} />
          ) : (
          <HomeAuthActions
            guest={
              <div className="flex items-center gap-2">
                <a
                  href="/sign-in"
                  className="focus-ring inline-flex min-h-[44px] items-center gap-2 rounded-[var(--r-md)] border border-[var(--gold-border)] bg-ivory px-4 py-2.5 text-sm font-semibold text-[var(--navy)]"
                >
                  {home.ctaSecondary}
                </a>
                <a
                  href="/sign-up"
                  className="focus-ring inline-flex min-h-[44px] items-center gap-2 rounded-[var(--r-md)] bg-[var(--navy)] px-4 py-2.5 text-sm font-semibold text-white"
                >
                  ابدأ الآن
                </a>
              </div>
            }
            user={
              <a
                href="/dashboard"
                className="focus-ring inline-flex min-h-[44px] items-center gap-2 rounded-[var(--r-md)] bg-[var(--navy)] px-5 py-2.5 text-sm font-semibold text-white"
              >
                المتابعة إلى المنصة
              </a>
            }
          />
          )}
        </header>

        <section
          id="ask"
          className="relative mx-auto flex max-w-3xl flex-col items-center px-6 pt-[5vh] pb-10 text-center"
        >
          <p className="mb-3 font-display text-sm font-semibold text-[var(--gold-dark)]">
            {home.brandName}
          </p>
          {/* font-display (مُحمَّل مسبقًا) بدل Amiri — يحسّن LCP على الجوال */}
          <h1 className="font-display text-3xl font-bold leading-tight text-[var(--navy)] md:text-5xl">
            ابدأ بسؤالك القانوني
          </h1>
          <p className="mt-3 max-w-xl text-base leading-8 text-[var(--ink-70)] md:text-lg">
            اطرح الواقعة أو المسألة، ودع حكيم يساعدك على فهمها والبحث في مصادرها وتنظيم مسار العمل
            عليها.
          </p>

          <HomeAuthActions
            guest={
              <div className="mt-8 w-full max-w-2xl text-right">
                <GuestAskComposer />
              </div>
            }
            user={
              inlineAuth ? (
                // بعد الدخول من الحوار: السؤال يُكمل هنا مرة واحدة دون مغادرة الصفحة
                <div className="mt-8 w-full max-w-2xl text-right">
                  <HomeInlineAskLazy />
                </div>
              ) : (
              <div className="mt-8 flex w-full max-w-md flex-col gap-3 sm:flex-row sm:justify-center">
                <a
                  href="/dashboard"
                  className="focus-ring inline-flex min-h-[48px] flex-1 items-center justify-center rounded-[var(--r-md)] bg-[var(--navy)] px-6 py-3.5 text-base font-semibold text-white"
                >
                  اسأل حكيم الآن
                </a>
              </div>
              )
            }
          />
        </section>

        <section
          id="services"
          className="relative mx-auto max-w-4xl px-6 pb-12 text-right"
          aria-labelledby="home-services-title"
        >
          <h2 id="home-services-title" className="font-display text-xl font-bold text-[var(--navy)]">
            أدوات أعمق عندما تحتاجها
          </h2>
          <p className="mt-2 text-sm leading-7 text-[var(--ink-60)]">
            بعد السؤال، يمكنك الانتقال إلى الخدمات المتخصصة دون أن تنافس مساحة «اسأل حكيم».
          </p>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {features.slice(0, 4).map((f) => (
              <li key={f.title}>
                <a
                  href={signUpWithNext(f.next)}
                  {...authLink("navigate", "sign-up", f.next)}
                  className="focus-ring block w-full rounded-[var(--r-lg)] border border-[var(--ink-08)] bg-ivory/90 px-4 py-4 text-start transition hover:border-[var(--gold-border)]"
                >
                  <p className="font-semibold text-[var(--navy)]">{f.title}</p>
                  <p className="mt-1 text-xs leading-6 text-[var(--ink-60)]">{f.desc}</p>
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section
          id="trust"
          className="relative mx-auto max-w-3xl px-6 pb-16 text-center"
          aria-labelledby="home-trust-title"
        >
          <h2 id="home-trust-title" className="font-display text-lg font-bold text-[var(--navy)]">
            لماذا حكيم
          </h2>
          <p className="mt-3 text-sm leading-8 text-[var(--ink-60)]">
            واجهة قانونية ذكية تبدأ بالسؤال، ثم تساعد على البحث والتحليل وتنظيم العمل — بمصدر نظامي
            موثّق وحدود استخدام واضحة.
          </p>
          <p className="mx-auto mt-6 max-w-xl text-xs leading-7 text-[var(--ink-40)]">
            {home.disclaimer}
          </p>
          {!authReady ? (
            <p className="mt-4 text-xs text-[var(--ink-40)]">{home.footnote}</p>
          ) : null}
        </section>
        {launcher}
      </main>
    );
  }

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
            <p className="text-lg font-bold text-[var(--navy)]">{home.brandName}</p>
            <p className="text-[11px] text-[var(--ink-60)]">{home.tagline}</p>
          </div>
        </div>

        <HomeAuthActions
          guest={
            inlineAuth ? (
              inlineGuestBar
            ) : (
            <div className="flex items-center gap-2">
              <a
                href="/sign-in"
                className="focus-ring inline-flex min-h-[44px] items-center gap-2 rounded-[var(--r-md)] border border-[var(--gold-border)] bg-ivory px-4 py-2.5 text-sm font-semibold text-[var(--navy)]"
              >
                {home.ctaSecondary}
              </a>
              <a
                href="/sign-up"
                className="focus-ring inline-flex min-h-[44px] items-center gap-2 rounded-[var(--r-md)] bg-[var(--navy)] px-4 py-2.5 text-sm font-semibold text-white"
              >
                سجّل مجانًا
              </a>
            </div>
            )
          }
          user={
            <a
              href="/dashboard"
              className="focus-ring inline-flex min-h-[44px] items-center gap-2 rounded-[var(--r-md)] border border-[var(--gold-border)] bg-ivory px-5 py-2.5 text-sm font-semibold text-[var(--navy)]"
            >
              الصفحة الرئيسية
            </a>
          }
        />
      </header>

      <section className="relative mx-auto flex max-w-3xl flex-col items-center px-6 pt-[7vh] pb-16 text-center">
        <p className="mb-4 font-display text-sm font-semibold text-[var(--gold-dark)]">
          {home.brandName}
        </p>
        <h1 className="font-display text-4xl font-bold leading-tight text-[var(--navy)] md:text-6xl">
          {home.headline}
        </h1>
        <p className="mt-4 max-w-xl text-base leading-8 text-[var(--ink-70)] md:text-lg">
          {home.lede}
        </p>

        <HomeAuthActions
          guest={
            <div className="mt-8 flex w-full max-w-md flex-col gap-3 sm:flex-row sm:justify-center">
              <a
                href={authReady ? "/sign-up" : "/sign-in"}
                {...authLink("login", "sign-up")}
                className="focus-ring inline-flex min-h-[48px] flex-1 items-center justify-center rounded-[var(--r-md)] bg-[var(--navy)] px-6 py-3.5 text-base font-semibold text-white shadow-[var(--sh-sm)] transition hover:bg-[var(--navy-mid)]"
              >
                {home.ctaPrimary}
              </a>
              <a
                href="/sign-in"
                {...authLink("login", "sign-in")}
                className="focus-ring inline-flex min-h-[48px] flex-1 items-center justify-center rounded-[var(--r-md)] border border-[var(--gold-border)] bg-ivory px-6 py-3.5 text-base font-semibold text-[var(--navy)] transition hover:border-[var(--gold)]"
              >
                {home.ctaSecondary}
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
                href="/dashboard"
                className="focus-ring inline-flex min-h-[48px] flex-1 items-center justify-center rounded-[var(--r-md)] border border-[var(--gold-border)] bg-ivory px-6 py-3.5 text-base font-semibold text-[var(--navy)]"
              >
                اسأل حكيم
              </a>
            </div>
          }
        />

        <p className="mt-4 text-sm text-[var(--ink-40)]">{home.footnote}</p>

        <ul className="mt-12 grid w-full gap-3 text-right sm:grid-cols-3">
          {features.map((f) => (
            <li key={f.title}>
              <a
                href={signUpWithNext(f.next)}
                {...authLink("navigate", "sign-up", f.next)}
                className="focus-ring block w-full rounded-[var(--r-lg)] border border-[var(--ink-08)] bg-ivory/90 px-4 py-4 text-start transition hover:border-[var(--gold-border)] hover:shadow-[var(--sh-xs)]"
              >
                <p className="font-semibold text-[var(--navy)]">{f.title}</p>
                <p className="mt-1 text-xs leading-6 text-[var(--ink-60)]">{f.desc}</p>
                <p className="mt-2 text-[11px] font-semibold text-[var(--gold-dark)]">
                  سجّل للمتابعة ←
                </p>
              </a>
            </li>
          ))}
        </ul>

        <p className="mx-auto mt-12 max-w-xl text-xs leading-7 text-[var(--ink-40)]">
          {home.disclaimer}
        </p>
      </section>
      {launcher}
    </main>
  );
}

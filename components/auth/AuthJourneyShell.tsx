import Link from "next/link";

const DEFAULT_POINTS = [
  "دخول آمن دون كلمة مرور إضافية",
  "العودة إلى الصفحة التي بدأت منها",
  "جلساتك وملفاتك في مساحة عمل واحدة",
] as const;

/** غلاف عربي موحّد لرحلة الدخول، مبني للجوال أولًا ومتوافق مع اتجاه RTL. */
export function AuthJourneyShell({
  tagline,
  points = DEFAULT_POINTS,
  children,
  footer,
  compact = false,
}: {
  tagline: string;
  points?: readonly string[];
  children: React.ReactNode;
  footer?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <main className={`login-page${compact ? " login-page--compact" : ""}`} lang="ar" dir="rtl">
      <a
        href="#auth-panel"
        className="focus-ring sr-only fixed start-4 top-4 z-[60] rounded-[var(--r-md)] bg-[var(--navy)] px-4 py-3 font-semibold text-white focus:not-sr-only"
      >
        تجاوز إلى بوابة الدخول
      </a>
      <div aria-hidden className="login-page__glow" />
      <div aria-hidden className="login-page__pattern" />

      <div className="login-page__grid">
        <aside className="login-brand" aria-label="تعريف حكيم">
          <div className="login-brand__inner">
            <Link href="/" className="focus-ring inline-flex flex-col items-start rounded-[var(--r-md)]" aria-label="حكيم — الصفحة الرئيسية">
              <span className="login-brand__mark" aria-hidden>ح</span>
              <span className="login-brand__title">حكيم</span>
            </Link>
            <p className="login-brand__tagline">{tagline}</p>
            <ul className="login-brand__points">
              {points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </div>
        </aside>

        <section id="auth-panel" className="login-panel" aria-label="بوابة الدخول">
          <div className="login-panel__card flex w-full flex-col items-center gap-4">
            <Link
              href="/"
              className="focus-ring inline-flex min-h-[48px] items-center gap-3 rounded-[var(--r-md)] px-2 text-[var(--navy)] lg:hidden"
              aria-label="حكيم — الصفحة الرئيسية"
            >
              <span className="grid h-10 w-10 place-items-center rounded-[var(--r-md)] bg-[var(--navy)] font-judicial text-lg font-bold text-[var(--gold-bright)]" aria-hidden>
                ح
              </span>
              <strong className="text-lg">حكيم</strong>
            </Link>
            {children}
            {footer ?? (
              <nav className="login-panel__links" aria-label="روابط نظامية">
                <Link href="/">الرئيسية</Link>
                <span aria-hidden>·</span>
                <Link href="/privacy">سياسة الخصوصية</Link>
                <span aria-hidden>·</span>
                <Link href="/terms">شروط الاستخدام</Link>
              </nav>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

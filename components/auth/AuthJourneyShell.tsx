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
            <Link href="/" className="login-brand__home focus-ring" aria-label="حكيم — الصفحة الرئيسية">
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
            <Link href="/" className="login-panel__brand focus-ring" aria-label="حكيم — الصفحة الرئيسية">
              <span aria-hidden>ح</span>
              <strong>حكيم</strong>
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

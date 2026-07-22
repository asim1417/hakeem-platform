import Link from "next/link";

const DEFAULT_POINTS = [
  "بعد الدخول أدخل الاسم والجوال والمهنة",
  "ثم استخدم اللوحة فورًا",
  "إكمال باقي الملف اختياري للمكافآت",
] as const;

/**
 * غلاف موحّد لرحلة الدخول — بطاقة واحدة بارزة، RTL عربي، هوية حكيم الهادئة.
 * صفحات المصادقة تُفرض عليها العربية واتجاه RTL حتى لو كانت لغة الواجهة العامة إنجليزية.
 */
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
  /** تقليل الحشو الرأسي لشاشات الجوال. */
  compact?: boolean;
}) {
  return (
    <main className={`login-page${compact ? " login-page--compact" : ""}`} lang="ar" dir="rtl">
      <div aria-hidden className="login-page__glow" />
      <div aria-hidden className="login-page__pattern" />
      <div className="login-page__grid">
        <aside className="login-brand" aria-label="هوية حكيم">
          <div className="login-brand__inner">
            <p className="login-brand__mark" aria-hidden>
              ح
            </p>
            <h1 className="login-brand__title">حكيم</h1>
            <p className="login-brand__tagline">{tagline}</p>
            <ul className="login-brand__points">
              {points.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        </aside>
        <section className="login-panel">
          <div className="login-panel__card flex w-full flex-col items-center gap-4">
            {children}
            {footer ?? (
              <nav className="login-panel__links" aria-label="روابط نظامية">
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

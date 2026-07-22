import Link from "next/link";

const DEFAULT_POINTS = [
  "بعد الدخول أدخل الاسم والجوال والمهنة",
  "ثم استخدم اللوحة فورًا",
  "إكمال باقي الملف اختياري للمكافآت",
] as const;

/** غلاف موحّد لرحلة الدخول → التسجيل → إكمال الملف (هوية حكيم). */
export function AuthJourneyShell({
  tagline,
  points = DEFAULT_POINTS,
  children,
  footer,
}: {
  tagline: string;
  points?: readonly string[];
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <main className="login-page">
      <div aria-hidden className="login-page__glow" />
      <div aria-hidden className="login-page__pattern" />
      <div className="login-page__grid">
        <aside className="login-brand">
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
          <div className="login-panel__card flex w-full flex-col items-center gap-5">
            {children}
            {footer ?? (
              <p className="login-panel__links">
                <Link href="/" className="underline-offset-4 hover:underline">
                  الرئيسية
                </Link>
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

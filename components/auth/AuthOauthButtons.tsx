import { buildOAuthStartPath } from "@/lib/modules/auth/clerk-oauth-start";
import {
  listVisibleAuthProviders,
  type VisibleAuthProvider,
} from "@/lib/modules/auth/auth-providers";
import { isGoogleOAuthConfigured } from "@/lib/modules/auth/google-oauth";

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.5-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 19 12 24 12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.6 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.2C29.2 35.2 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.5l.1.1 6.3 5.2C39.1 37.3 44 33 44 24c0-1.3-.1-2.5-.4-3.5z" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden fill="currentColor">
      <path d="M16.4 12.6c0-2.1 1.7-3.1 1.8-3.2-1-1.4-2.5-1.6-3-1.7-1.3-.1-2.5.8-3.1.8s-1.6-.7-2.7-.7c-1.4 0-2.7.8-3.4 2.1-1.5 2.5-.4 6.3 1 8.4.7 1 1.5 2.2 2.6 2.1 1-.1 1.4-.7 2.7-.7s1.6.7 2.7.6c1.1-.1 1.8-1 2.5-2 .8-1.1 1.1-2.2 1.1-2.3-.1 0-2.1-.8-2.2-3.2zM14.5 6.2c.6-.7 1-1.7.9-2.7-1 .1-2.1.6-2.7 1.4-.6.6-1.1 1.7-.9 2.6 1 .1 2-.5 2.7-1.3z" />
    </svg>
  );
}

/** بوابة OAuth موحّدة: الحساب القائم والجديد يمران من الخطوة نفسها. */
export function AuthOauthButtons({
  mode,
  nextUrl = "/dashboard",
  id,
  className = "",
  embedded = false,
  visibleProviders,
  errorMessage,
}: {
  mode: "sign-in" | "sign-up";
  nextUrl?: string;
  id?: string;
  className?: string;
  embedded?: boolean;
  visibleProviders?: VisibleAuthProvider[];
  errorMessage?: string;
}) {
  const providers = visibleProviders ?? listVisibleAuthProviders();
  const showGoogle = providers.includes("google");
  const showApple = providers.includes("apple");
  const googleHref = `/api/auth/google?next=${encodeURIComponent(nextUrl)}`;
  const appleHref = buildOAuthStartPath({ provider: "apple", nextUrl, mode });
  const googleNativePreferred = isGoogleOAuthConfigured();

  if (!showGoogle && !showApple) {
    return (
      <div
        id={id}
        className={`w-full max-w-[26rem] rounded-[var(--r-xl)] border border-[var(--ink-08)] bg-[var(--paper)] p-6 text-center shadow-[var(--sh-sm)] ${className}`.trim()}
        role="alert"
      >
        <p className="text-sm font-bold text-[var(--navy)]">الدخول غير متاح مؤقتًا</p>
        <p className="mt-2 text-sm leading-7 text-[var(--ink-60)]">
          تعذّر تحميل وسيلة الدخول المفعّلة. أعد المحاولة بعد قليل.
        </p>
        <a href="/" className="focus-ring mt-5 inline-flex min-h-[44px] items-center rounded-[var(--r-md)] px-3 text-sm font-semibold text-[var(--gold-dark)]">
          العودة إلى الرئيسية
        </a>
      </div>
    );
  }

  return (
    <div
      id={id}
      data-google-native={googleNativePreferred ? "1" : "0"}
      className={`w-full max-w-[26rem] rounded-[var(--r-xl)] border border-[var(--ink-08)] bg-[var(--paper)] p-5 shadow-[var(--sh-sm)] sm:p-6 ${className}`.trim()}
    >
      <header className="text-center">
        <p className="text-xs font-semibold text-[var(--gold-dark)]">بوابة موحّدة</p>
        <h1 className="mt-2 text-[1.45rem] font-bold leading-9 text-[var(--navy)]">الدخول إلى حكيم</h1>
        <p className="mt-2 text-sm leading-7 text-[var(--ink-60)]">
          تابع بحسابك الحالي، أو أنشئ حسابًا جديدًا تلقائيًا.
        </p>
      </header>

      {errorMessage ? (
        <div className="mt-5 rounded-[var(--r-md)] border border-[rgba(140,34,51,0.2)] bg-[var(--ruby-soft)] px-4 py-3 text-start text-sm leading-7 text-[var(--ruby)]" role="alert">
          {errorMessage}
        </div>
      ) : null}

      <div className="mt-6 flex flex-col gap-3">
        {showGoogle ? (
          <a
            href={googleHref}
            aria-label="المتابعة بحساب Google"
            className="focus-ring flex min-h-[52px] w-full items-center justify-center gap-3 rounded-[var(--r-md)] border border-[var(--ink-15)] bg-white px-4 text-[0.95rem] font-semibold text-[var(--navy)] transition hover:border-[var(--gold-border)] hover:bg-[var(--hakeem-bg)]"
          >
            <GoogleIcon />
            <span>المتابعة بحساب Google</span>
          </a>
        ) : null}

        {showApple ? (
          <a
            href={appleHref}
            aria-label="المتابعة بحساب Apple"
            className="focus-ring flex min-h-[52px] w-full items-center justify-center gap-3 rounded-[var(--r-md)] border border-[var(--ink-15)] bg-white px-4 text-[0.95rem] font-semibold text-[var(--navy)] transition hover:border-[var(--gold-border)] hover:bg-[var(--hakeem-bg)]"
          >
            <AppleIcon />
            <span>المتابعة بحساب Apple</span>
          </a>
        ) : null}
      </div>

      <div className="mt-5 rounded-[var(--r-md)] bg-[var(--hakeem-bg)] px-4 py-3 text-start text-xs leading-6 text-[var(--ink-60)]">
        لن نطلب كلمة مرور Google أو Apple، وستعود إلى الصفحة التي بدأت منها بعد الدخول.
      </div>

      <p className="mt-5 text-center text-xs leading-6 text-[var(--ink-60)]">
        بالمتابعة، فإنك توافق على{" "}
        <a href="/terms" className="focus-ring rounded font-semibold text-[var(--navy)] underline-offset-2 hover:underline">
          شروط الاستخدام
        </a>{" "}
        و
        <a href="/privacy" className="focus-ring rounded font-semibold text-[var(--navy)] underline-offset-2 hover:underline">
          سياسة الخصوصية
        </a>
        .
      </p>

      {embedded ? (
        <p className="mt-4 text-center text-xs text-[var(--ink-40)]">تُفتح الجلسة داخل مساحة عمل حكيم.</p>
      ) : null}
    </div>
  );
}

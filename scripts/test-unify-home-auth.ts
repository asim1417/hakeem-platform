/**
 * الصفحة العامة وبوابة الدخول — صياغة، وصولية، واستمرار السياق.
 * npx tsx scripts/test-unify-home-auth.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { loginErrorMessage } from "../lib/modules/auth/login-error-message";
import { resolvePostAuthNext, safeDashboardNext, signInWithNext } from "../lib/modules/auth/safe-next";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

assert.equal(safeDashboardNext("/dashboard/ask"), "/dashboard/ask");
assert.equal(safeDashboardNext("//evil"), "/dashboard");
assert.equal(resolvePostAuthNext({ returnUrl: "/admin" }), "/admin");
assert.equal(resolvePostAuthNext({ next: "/documents" }), "/documents");
assert.ok(signInWithNext("/dashboard/ask").startsWith("/sign-in?next="));
assert.match(loginErrorMessage("invalid_oauth_state") || "", /أعد المحاولة/);
assert.match(loginErrorMessage("session_establish_failed") || "", /جلسة حكيم/);

const provider = read("components/providers/ClerkAppProvider.tsx");
assert.ok(provider.includes('import("@clerk/nextjs")'));
assert.ok(provider.includes("useClerkMounted"));
assert.ok(provider.includes('afterSignOutUrl="/"'));
assert.equal(provider.includes("signInForceRedirectUrl"), false);

const home = read("components/home/HomeHero.tsx");
assert.equal(home.includes('"use client"'), false);
assert.equal(home.includes("AuthOauthButtons"), false);
assert.ok(home.includes("DirectGoogleEntry"));
assert.ok(home.includes("HomeVideoShowcase"));
assert.ok(home.includes('href="#main-content"'));
assert.ok(home.includes("تجاوز إلى المحتوى"));
assert.ok(home.includes('href="#tour"'));
assert.ok(home.includes('id="database"'));
assert.ok(home.includes('id="services"'));
assert.ok(home.includes('id="difference"'));
assert.ok(home.includes("scroll-mt-24"));
assert.ok(home.includes("min-h-[44px]"));
assert.ok(home.includes("PublicPlatformStats"));
assert.ok(home.includes("stats.legalSystems"));
assert.ok(home.includes("stats.legalArticles"));
assert.ok(home.includes("حرّر المسألة. راجع السند."));
assert.ok(home.includes("وأكمل العمل في ملف واحد."));
assert.ok(home.includes("بحث نظامي، تحليل مستندات، وإدارة ملف القضية"));
assert.ok(home.includes("مخرج قابل للمراجعة"));
assert.ok(home.includes("منصة تقنية قانونية للممارسة السعودية"));
assert.ok(home.includes("تحرير المسألة"));
assert.ok(home.includes("إظهار السند"));
assert.ok(home.includes("استمرار السياق"));
assert.ok(home.includes("اسأل حكيم"));
assert.ok(home.includes("النواة القانونية"));
assert.ok(home.includes("منصة الوثائق"));
assert.ok(home.includes("المعاون القضائي"));
assert.ok(home.includes("القاضي التفاعلي"));
assert.ok(home.includes("الاستشارات القانونية"));
assert.ok(home.includes("٢٨ دفعًا"));
assert.ok(home.includes("٢٠٠٬٠٠٠"));
assert.ok(home.includes("الدخول عبر Google"));
assert.ok(home.includes("ابدأ عبر Google"));
assert.ok(home.includes('/api/auth/google?next=%2Fdashboard'));
assert.equal(home.includes('href="/sign-in"'), false);
assert.equal(home.includes('href="/sign-up"'), false);
assert.ok(home.includes('href="/privacy"'));
assert.ok(home.includes('href="/terms"'));

const videoShowcase = read("components/home/HomeVideoShowcase.tsx");
assert.ok(videoShowcase.includes('id="tour"'));
assert.ok(videoShowcase.includes("شاهد مسار العمل داخل حكيم"));
assert.ok(videoShowcase.includes("NEXT_PUBLIC_HOME_VIDEO_URL"));
assert.ok(videoShowcase.includes("NEXT_PUBLIC_HOME_VIDEO_CAPTIONS_URL"));
assert.ok(videoShowcase.includes('kind="captions"'));
assert.ok(videoShowcase.includes('preload="metadata"'));
assert.ok(videoShowcase.includes("playsInline"));
assert.equal(videoShowcase.includes("autoPlay"), false);
assert.equal(videoShowcase.includes("autoplay"), false);
assert.equal(videoShowcase.includes("loop"), false);

const directGoogle = read("components/auth/DirectGoogleEntry.tsx");
assert.ok(directGoogle.includes("/api/auth/google?next="));
assert.ok(directGoogle.includes("جاري فتح Google"));
assert.ok(directGoogle.includes("aria-busy"));
assert.ok(directGoogle.includes("isRedirecting"));

const publicStats = read("lib/modules/site/public-platform-stats.ts");
assert.ok(publicStats.includes("prisma.legalSystem.count"));
assert.ok(publicStats.includes("prisma.legalArticle.count"));
assert.ok(publicStats.includes("prisma.judicialCase.count"));
assert.ok(publicStats.includes("prisma.judicialPrinciple.count"));

const page = read("app/page.tsx");
assert.ok(page.includes("getPublicPlatformStats"));
assert.ok(page.includes("Promise.all"));
assert.ok(page.includes("stats={stats}"));
assert.ok(page.includes("loginErrorMessage"));
assert.ok(page.includes("loginError={loginErrorMessage"));
assert.ok(page.includes("منصة تقنية قانونية للممارسة السعودية"));
assert.ok(page.includes("بحث في الأنظمة والأحكام"));

const guestAsk = read("components/home/GuestAskComposer.tsx");
assert.ok(guestAsk.includes("sessionStorage.setItem(HOME_ASK_DRAFT_KEY"));
assert.ok(guestAsk.includes("/api/auth/google?next="));
assert.ok(guestAsk.includes("window.location.assign(GOOGLE_ENTRY_PATH)"));
assert.equal(guestAsk.includes('signInWithNext("/dashboard")'), false);
assert.equal(guestAsk.includes("signUpWithNext"), false);
assert.ok(guestAsk.includes("تعود إليه بعد اكتمال الدخول"));
assert.ok(guestAsk.includes("تابع إلى حكيم عبر Google"));
assert.ok(guestAsk.includes("جاري فتح Google"));
assert.ok(guestAsk.includes("disabled={isRedirecting}"));

const callback = read("app/api/auth/callback/google/route.ts");
assert.ok(callback.includes('new URL("/", request.url)'));
assert.ok(callback.includes('searchParams.set("login_error", reason)'));
assert.ok(callback.includes('recoveryUrl.hash = "main-content"'));
assert.equal(callback.includes("/sign-in?login_error="), false);

const journey = read("components/auth/AuthJourneyShell.tsx");
assert.ok(journey.includes('lang="ar" dir="rtl"'));
assert.ok(journey.includes("تجاوز إلى بوابة الدخول"));
assert.ok(journey.includes("دخول آمن دون كلمة مرور إضافية"));
assert.ok(journey.includes("min-h-[48px]"));

const signIn = read("app/sign-in/[[...sign-in]]/page.tsx");
assert.ok(signIn.includes("AuthOauthButtons"));
assert.ok(signIn.includes("loginErrorMessage"));
assert.ok(signIn.includes("errorMessage={errorMessage}"));
assert.ok(signIn.includes("resolvePostAuthNext"));

const signUp = read("app/sign-up/[[...sign-up]]/page.tsx");
assert.ok(signUp.includes("AuthOauthButtons"));
assert.ok(signUp.includes("loginErrorMessage"));
assert.ok(signUp.includes("errorMessage={errorMessage}"));

const oauth = read("components/auth/AuthOauthButtons.tsx");
assert.ok(oauth.includes("الدخول إلى حكيم"));
assert.ok(oauth.includes("أنشئ حسابًا جديدًا تلقائيًا"));
assert.ok(oauth.includes("المتابعة بحساب Google"));
assert.ok(oauth.includes("لن نطلب كلمة مرور Google أو Apple"));
assert.ok(oauth.includes("min-h-[52px]"));
assert.equal(oauth.includes("مستخدم جديد؟"), false);
assert.ok(oauth.includes("/api/auth/google") || oauth.includes("buildOAuthStartPath"));

const login = read("app/login/page.tsx");
assert.ok(login.includes("redirect(`/sign-in"));
assert.ok(login.includes("hasAnySignInProvider"));

const register = read("app/register/page.tsx");
assert.ok(register.includes("redirect(`/sign-up"));

const logout = read("components/LogoutButton.tsx");
assert.ok(logout.includes('AFTER_LOGOUT = "/"'));
assert.ok(logout.includes("redirectUrl={AFTER_LOGOUT}"));

const notFound = read("app/not-found.tsx");
assert.ok(notFound.includes('href="/"'));

console.log("test-unify-home-auth: OK");

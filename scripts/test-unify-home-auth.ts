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
assert.ok(home.includes('href="#main-content"'));
assert.ok(home.includes("تجاوز إلى المحتوى"));
assert.ok(home.includes('id="database"'));
assert.ok(home.includes('id="services"'));
assert.ok(home.includes('id="method"'));
assert.ok(home.includes("scroll-mt-24"));
assert.ok(home.includes("min-h-[44px]"));
assert.ok(home.includes("PublicPlatformStats"));
assert.ok(home.includes("stats.legalSystems"));
assert.ok(home.includes("stats.legalArticles"));
assert.ok(home.includes("من السؤال إلى المخرج القانوني"));
assert.ok(home.includes("بسندٍ نظامي ظاهر"));
assert.ok(home.includes("اسأل حكيم"));
assert.ok(home.includes("النواة القانونية"));
assert.ok(home.includes("منصة الوثائق"));
assert.ok(home.includes("المعاون القضائي"));
assert.ok(home.includes("القاضي التفاعلي"));
assert.ok(home.includes("الاستشارات القانونية"));
assert.ok(home.includes("٢٨ دفعًا"));
assert.ok(home.includes("٢٠٠٬٠٠٠"));
assert.ok(home.includes('href="/privacy"'));
assert.ok(home.includes('href="/terms"'));

const publicStats = read("lib/modules/site/public-platform-stats.ts");
assert.ok(publicStats.includes("prisma.legalSystem.count"));
assert.ok(publicStats.includes("prisma.legalArticle.count"));
assert.ok(publicStats.includes("prisma.judicialCase.count"));
assert.ok(publicStats.includes("prisma.judicialPrinciple.count"));

const page = read("app/page.tsx");
assert.ok(page.includes("getPublicPlatformStats"));
assert.ok(page.includes("Promise.all"));
assert.ok(page.includes("stats={stats}"));
assert.ok(page.includes("منصة العمل القانوني السعودي"));

const guestAsk = read("components/home/GuestAskComposer.tsx");
assert.ok(guestAsk.includes("sessionStorage.setItem(HOME_ASK_DRAFT_KEY"));
assert.ok(guestAsk.includes('signInWithNext("/dashboard")'));
assert.equal(guestAsk.includes("signUpWithNext"), false);
assert.ok(guestAsk.includes("لا يُضاف إلى رابط الدخول"));
assert.ok(guestAsk.includes("ابدأ التحليل"));

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

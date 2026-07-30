/**
 * توحيد الصفحة الرئيسية وبوابة الدخول.
 * npx tsx scripts/test-unify-home-auth.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { resolvePostAuthNext, safeDashboardNext, signInWithNext } from "../lib/modules/auth/safe-next";

const root = process.cwd();

assert.equal(safeDashboardNext("/dashboard/ask"), "/dashboard/ask");
assert.equal(safeDashboardNext("//evil"), "/dashboard");
assert.equal(resolvePostAuthNext({ returnUrl: "/admin" }), "/admin");
assert.equal(resolvePostAuthNext({ next: "/documents" }), "/documents");
assert.ok(signInWithNext("/dashboard/ask").startsWith("/sign-in?next="));

const provider = fs.readFileSync(path.join(root, "components/providers/ClerkAppProvider.tsx"), "utf8");
assert.ok(provider.includes('import("@clerk/nextjs")'));
assert.ok(provider.includes("useClerkMounted"));
assert.ok(provider.includes('afterSignOutUrl="/"'));
assert.equal(provider.includes("signInForceRedirectUrl"), false);

const home = fs.readFileSync(path.join(root, "components/home/HomeHero.tsx"), "utf8");
assert.equal(home.includes('"use client"'), false);
assert.equal(home.includes("AuthOauthButtons"), false);
assert.ok(home.includes('from "next/link"'));
assert.ok(home.includes('href="/sign-in"'));
assert.ok(home.includes('href="/sign-up"'));
assert.ok(home.includes("GuestAskComposer"));
assert.ok(home.includes('id="database"'));
assert.ok(home.includes('id="services"'));
assert.ok(home.includes('id="method"'));
assert.ok(home.includes("PublicPlatformStats"));
assert.ok(home.includes("stats.legalSystems"));
assert.ok(home.includes("stats.legalArticles"));
assert.ok(home.includes("اسأل حكيم"));
assert.ok(home.includes("النواة القانونية"));
assert.ok(home.includes("منصة الوثائق"));
assert.ok(home.includes("المعاون القضائي"));
assert.ok(home.includes("القاضي التفاعلي"));
assert.ok(home.includes("٢٨ دفعًا"));
assert.ok(home.includes("٢٠٠٬٠٠٠"));
assert.ok(home.includes('href="/privacy"'));
assert.ok(home.includes('href="/terms"'));

const publicStats = fs.readFileSync(
  path.join(root, "lib/modules/site/public-platform-stats.ts"),
  "utf8"
);
assert.ok(publicStats.includes("prisma.legalSystem.count"));
assert.ok(publicStats.includes("prisma.legalArticle.count"));
assert.ok(publicStats.includes("prisma.judicialCase.count"));
assert.ok(publicStats.includes("prisma.judicialPrinciple.count"));

const page = fs.readFileSync(path.join(root, "app/page.tsx"), "utf8");
assert.ok(page.includes("getPublicPlatformStats"));
assert.ok(page.includes("stats={stats}"));

const login = fs.readFileSync(path.join(root, "app/login/page.tsx"), "utf8");
assert.ok(login.includes("redirect(`/sign-in"));
assert.ok(login.includes("hasAnySignInProvider"));

const register = fs.readFileSync(path.join(root, "app/register/page.tsx"), "utf8");
assert.ok(register.includes("redirect(`/sign-up"));

const signIn = fs.readFileSync(path.join(root, "app/sign-in/[[...sign-in]]/page.tsx"), "utf8");
assert.ok(signIn.includes("AuthOauthButtons"));
assert.ok(signIn.includes("listVisibleAuthProviders"));
assert.ok(signIn.includes("resolvePostAuthNext"));

const oauth = fs.readFileSync(path.join(root, "components/auth/AuthOauthButtons.tsx"), "utf8");
assert.ok(oauth.includes("المتابعة باستخدام Google"));
assert.ok(oauth.includes("/api/auth/google") || oauth.includes("buildOAuthStartPath"));
assert.ok(oauth.includes("listVisibleAuthProviders"));

const logout = fs.readFileSync(path.join(root, "components/LogoutButton.tsx"), "utf8");
assert.ok(logout.includes('AFTER_LOGOUT = "/"'));
assert.ok(logout.includes("redirectUrl={AFTER_LOGOUT}"));

const notFound = fs.readFileSync(path.join(root, "app/not-found.tsx"), "utf8");
assert.ok(notFound.includes('href="/"'));

const ownerGate = fs.readFileSync(path.join(root, "app/internal/owner-gate/page.tsx"), "utf8");
assert.ok(ownerGate.includes("internal/owner-gate"));

console.log("test-unify-home-auth: OK");

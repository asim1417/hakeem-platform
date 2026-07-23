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
assert.ok(home.includes('href="/sign-in"'));
assert.ok(home.includes('href="/sign-up"'));

const login = fs.readFileSync(path.join(root, "app/login/page.tsx"), "utf8");
assert.ok(login.includes('redirect(`/sign-in'));

const register = fs.readFileSync(path.join(root, "app/register/page.tsx"), "utf8");
assert.ok(register.includes('redirect(`/sign-up'));

const signIn = fs.readFileSync(path.join(root, "app/sign-in/[[...sign-in]]/page.tsx"), "utf8");
assert.ok(signIn.includes("resolvePostAuthNext"));
assert.ok(signIn.includes("بوابة الدخول الموحّدة"));

const oauth = fs.readFileSync(path.join(root, "components/auth/AuthOauthOnly.tsx"), "utf8");
assert.ok(oauth.includes("useClerkMounted"));
assert.ok(oauth.includes("AuthOauthOnlyInner"));

const logout = fs.readFileSync(path.join(root, "components/LogoutButton.tsx"), "utf8");
assert.ok(logout.includes('AFTER_LOGOUT = "/"'));
assert.ok(logout.includes('redirectUrl={AFTER_LOGOUT}'));

const notFound = fs.readFileSync(path.join(root, "app/not-found.tsx"), "utf8");
assert.ok(notFound.includes('href="/"'));

const ownerGate = fs.readFileSync(path.join(root, "app/internal/owner-gate/page.tsx"), "utf8");
assert.ok(ownerGate.includes("internal/owner-gate"));

console.log("test-unify-home-auth: OK");

/**
 * npx tsx scripts/test-production-auth.ts
 * سياسة الإنتاج: Google أصلي مفضّل، ورفض Clerk pk_test_ على النطاق الحي.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

async function main() {
  const root = resolve(process.cwd());

  process.env.VERCEL_ENV = "production";
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
  delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  delete process.env.CLERK_SECRET_KEY;

  // إعادة تحميل الوحدة بعد ضبط البيئة
  const mod = await import("../lib/modules/auth/production-auth");

  assert.equal(mod.getClerkInstanceKind(), "missing");
  assert.equal(mod.allowClerkGoogleFallback(), false);
  assert.equal(mod.isAuthProductionReady(), false);

  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY =
    "pk_test_c2FmZS1lbGstNTAuY2xlcmsuYWNjb3VudHMuZGV2JA";
  process.env.CLERK_SECRET_KEY = "sk_test_dummy";
  assert.equal(mod.getClerkInstanceKind(), "test");
  assert.equal(mod.allowClerkGoogleFallback(), false);
  assert.equal(mod.isAuthProductionReady(), false);

  const host = mod.getAuthProductionStatus().clerkFrontendHost;
  assert.equal(host, "safe-elk-50.clerk.accounts.dev");

  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_live_dummy";
  process.env.CLERK_SECRET_KEY = "sk_live_dummy";
  assert.equal(mod.getClerkInstanceKind(), "live");
  assert.equal(mod.allowClerkGoogleFallback(), true);
  assert.equal(mod.isAuthProductionReady(), true);

  process.env.GOOGLE_CLIENT_ID = "gid.apps.googleusercontent.com";
  process.env.GOOGLE_CLIENT_SECRET = "gsec";
  assert.equal(mod.getAuthProductionStatus().googleMode, "native");
  assert.equal(mod.getAuthProductionStatus().ready, true);
  assert.ok(mod.getAuthProductionStatus().recommendation.includes("Google"));

  const googleRoute = readFileSync(resolve(root, "app/api/auth/google/route.ts"), "utf8");
  assert.ok(googleRoute.includes("allowClerkGoogleFallback"));
  assert.ok(googleRoute.includes("google_keys_required"));

  const oauthStart = readFileSync(resolve(root, "app/api/auth/oauth/start/route.ts"), "utf8");
  assert.ok(oauthStart.includes("allowClerkGoogleFallback"));
  assert.ok(oauthStart.includes("google_keys_required"));

  const health = readFileSync(resolve(root, "app/api/health/route.ts"), "utf8");
  assert.ok(health.includes("getAuthProductionStatus"));
  assert.ok(health.includes("authProduction"));

  const signIn = readFileSync(resolve(root, "app/sign-in/[[...sign-in]]/page.tsx"), "utf8");
  assert.ok(signIn.includes("google_keys_required"));

  const services = readFileSync(resolve(root, "app/admin/services/page.tsx"), "utf8");
  assert.ok(services.includes("getAuthProductionStatus"));
  assert.ok(services.includes("جاهزية دخول الإنتاج"));
  assert.ok(services.includes("/admin/settings"));

  const adminHome = readFileSync(resolve(root, "app/admin/page.tsx"), "utf8");
  assert.ok(adminHome.includes("جاهزية دخول الإنتاج"));
  assert.ok(adminHome.includes("auth.production"));

  console.log("test-production-auth: OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

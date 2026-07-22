/**
 * اختبار عزل دخول المالك + إخفاء Development mode.
 * npx tsx scripts/test-owner-emergency.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  isClerkProductionPublishableKey,
  isOwnerEmergencyLoginEnabled,
  shouldHideClerkDevelopmentModeUi,
} from "../lib/modules/auth/owner-emergency";

const root = process.cwd();

// بدون أعلام → معطّل
delete process.env.OWNER_EMERGENCY_LOGIN_ENABLED;
delete process.env.OWNER_EMERGENCY_ALLOW_PRODUCTION;
assert.equal(isOwnerEmergencyLoginEnabled(), false);

process.env.OWNER_EMERGENCY_LOGIN_ENABLED = "true";
process.env.VERCEL_ENV = "development";
assert.equal(isOwnerEmergencyLoginEnabled(), true);

process.env.VERCEL_ENV = "production";
assert.equal(isOwnerEmergencyLoginEnabled(), false);
process.env.OWNER_EMERGENCY_ALLOW_PRODUCTION = "true";
assert.equal(isOwnerEmergencyLoginEnabled(), true);

assert.equal(isClerkProductionPublishableKey("pk_live_abc"), true);
assert.equal(isClerkProductionPublishableKey("pk_test_abc"), false);

process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_live_x";
assert.equal(shouldHideClerkDevelopmentModeUi(), true);
process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_x";
process.env.VERCEL_ENV = "production";
assert.equal(shouldHideClerkDevelopmentModeUi(), true);

// الصفحة العامة بلا OwnerEmergencyLogin
const signIn = fs.readFileSync(path.join(root, "app/sign-in/[[...sign-in]]/page.tsx"), "utf8");
assert.equal(signIn.includes("OwnerEmergencyLogin"), false);
assert.equal(signIn.includes("دخول المالك"), false);

const login = fs.readFileSync(path.join(root, "app/login/page.tsx"), "utf8");
assert.equal(login.includes("OwnerEmergencyLogin"), false);

const clerkSignIn = fs.readFileSync(path.join(root, "components/auth/AuthClerkSignIn.tsx"), "utf8");
assert.equal(clerkSignIn.includes("OwnerEmergencyLogin"), false);

const ownerPage = fs.readFileSync(path.join(root, "app/internal/owner-gate/page.tsx"), "utf8");
assert.ok(ownerPage.includes("isOwnerEmergencyLoginEnabled"));
assert.ok(ownerPage.includes("OwnerEmergencyLogin"));

const api = fs.readFileSync(path.join(root, "app/api/auth/owner-login/route.ts"), "utf8");
assert.ok(api.includes("isOwnerEmergencyLoginEnabled"));

const ownerUi = fs.readFileSync(path.join(root, "components/auth/OwnerEmergencyLogin.tsx"), "utf8");
assert.equal(ownerUi.includes("Qalam-1703"), false);
assert.equal(ownerUi.includes("Clerk"), false);

console.log("test-owner-emergency: OK");

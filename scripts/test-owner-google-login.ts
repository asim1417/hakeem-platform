/**
 * دخول المالك عبر Google — لا يُسقطه تعارض Clerk.
 * npx tsx scripts/test-owner-google-login.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { isPlatformOwnerEmail, PLATFORM_OWNER_EMAILS } from "../lib/modules/auth/oauth-shared";

const root = process.cwd();

assert.equal(PLATFORM_OWNER_EMAILS[0], "aasemalfarsi@gmail.com");
assert.equal(isPlatformOwnerEmail("aasemalfarsi@gmail.com"), true);
assert.equal(isPlatformOwnerEmail("AasemAlFarsi@gmail.com"), true);

const establish = fs.readFileSync(
  path.join(root, "lib/modules/auth/establish-session.ts"),
  "utf8"
);
assert.ok(establish.includes("provisionOAuthUser"));
// يجب تثبيت الجلسة المحلية قبل Clerk
const provIdx = establish.indexOf("provisionOAuthUser");
const clerkIdx = establish.indexOf("ensureLocalUserFromClerk");
assert.ok(provIdx > 0 && clerkIdx > provIdx, "local session must precede Clerk sync");
assert.ok(establish.includes("best-effort") || establish.includes("اختيارية") || establish.includes("لا تُسقط"));

const clerkSync = fs.readFileSync(path.join(root, "lib/modules/auth/clerk-sync.ts"), "utf8");
assert.ok(clerkSync.includes("byClerk") || clerkSync.includes("byEmail"));
assert.ok(clerkSync.includes("clerkId: null"));
assert.ok(clerkSync.includes("SYSTEM_ADMIN"));

const oauthUser = fs.readFileSync(path.join(root, "lib/modules/auth/oauth-user.ts"), "utf8");
assert.ok(oauthUser.includes("SUPER_ADMIN"));
assert.ok(oauthUser.includes("SYSTEM_ADMIN"));

const session = fs.readFileSync(path.join(root, "lib/modules/auth/session.ts"), "utf8");
const cookieFirst = session.indexOf("userFromOwnerCookie");
const clerkResolve = session.indexOf("resolveClerkUser");
assert.ok(cookieFirst > 0 && cookieFirst < clerkResolve, "hakeem_session before Clerk in getCurrentUser");

const callback = fs.readFileSync(
  path.join(root, "app/api/auth/callback/google/route.ts"),
  "utf8"
);
assert.ok(callback.includes("/sign-in?login_error="));
assert.equal(callback.includes("#login"), false);

console.log("test-owner-google-login: OK");

/**
 * اختبار بوابة middleware بلا Clerk.
 * npx tsx scripts/test-middleware-gate.ts
 */
import assert from "node:assert/strict";
import {
  hasOwnerSessionCookie,
  isProtectedPath,
  resolveUnauthenticatedGate,
} from "../lib/modules/auth/middleware-gate";

assert.equal(isProtectedPath("/dashboard"), true);
assert.equal(isProtectedPath("/dashboard/cases"), true);
assert.equal(isProtectedPath("/login"), false);
assert.equal(isProtectedPath("/sign-in"), false);
assert.equal(isProtectedPath("/api/auth/owner-login"), false);

assert.equal(hasOwnerSessionCookie("hakeem_session=abc"), true);
assert.equal(hasOwnerSessionCookie("other=1; hakeem_session=xyz"), true);
assert.equal(hasOwnerSessionCookie("session=nope"), false);
assert.equal(hasOwnerSessionCookie(null), false);

assert.equal(resolveUnauthenticatedGate("/login", "", null), "allow");
assert.equal(resolveUnauthenticatedGate("/dashboard", "", null), "redirect-login");
assert.equal(
  resolveUnauthenticatedGate("/dashboard", "", "hakeem_session=owner"),
  "allow"
);
assert.equal(resolveUnauthenticatedGate("/admin/users", "?x=1", null), "redirect-login");

console.log("test-middleware-gate: OK");

/**
 * npx tsx scripts/test-session-cookie-peek.ts
 */
import assert from "node:assert/strict";
import {
  peekSessionRole,
  workspaceHomeFromSessionCookie,
} from "../lib/modules/auth/session-cookie-peek";

function fakeCookie(role: string, expOffsetMs = 60_000): string {
  const body = Buffer.from(
    JSON.stringify({
      userId: "u1",
      role,
      name: "ت",
      email: "t@example.com",
      exp: Date.now() + expOffsetMs,
      nonce: "n",
    }),
    "utf8"
  ).toString("base64url");
  return `${body}.fakesig`;
}

assert.equal(peekSessionRole(undefined), null);
assert.equal(peekSessionRole(""), null);
assert.equal(peekSessionRole("not-a-token"), null);
assert.equal(peekSessionRole(fakeCookie("LAWYER")), "LAWYER");
assert.equal(peekSessionRole(fakeCookie("SUPER_ADMIN")), "SUPER_ADMIN");
assert.equal(peekSessionRole(fakeCookie("SUPER_ADMIN", -1000)), null, "expired");

assert.equal(workspaceHomeFromSessionCookie(fakeCookie("LAWYER")), "/dashboard");
assert.equal(workspaceHomeFromSessionCookie(fakeCookie("SUPER_ADMIN")), "/admin");
assert.equal(
  workspaceHomeFromSessionCookie(fakeCookie("SUPER_ADMIN"), { superPanelEnabled: false }),
  "/dashboard"
);
assert.equal(workspaceHomeFromSessionCookie(undefined), "/dashboard");

console.log("test-session-cookie-peek: OK");

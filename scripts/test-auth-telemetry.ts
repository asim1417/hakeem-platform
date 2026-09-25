/**
 * قياس مصادقة مجرّد — بلا PII.
 * npx tsx scripts/test-auth-telemetry.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { recordAuthTelemetry } from "../lib/modules/auth/auth-telemetry";

const root = process.cwd();

const lines: string[] = [];
const orig = console.log;
console.log = (...args: unknown[]) => {
  lines.push(args.map(String).join(" "));
};

recordAuthTelemetry({
  provider: "password",
  outcome: "failure",
  reason: "invalid_credentials",
  surface: "sign_in",
});
console.log = orig;

assert.ok(lines.length >= 1);
const payload = JSON.parse(lines[0]!) as Record<string, unknown>;
assert.equal(payload.event, "auth.telemetry");
assert.equal(payload.provider, "password");
assert.equal(payload.outcome, "failure");
assert.equal(payload.reason, "invalid_credentials");
assert.equal("email" in payload, false);
assert.equal("token" in payload, false);
assert.equal("password" in payload, false);

const pw = fs.readFileSync(path.join(root, "app/api/auth/password-login/route.ts"), "utf8");
assert.ok(pw.includes("recordAuthTelemetry"));
assert.equal(/metadata:\s*\{\s*email/.test(pw), false);

const google = fs.readFileSync(path.join(root, "app/api/auth/callback/google/route.ts"), "utf8");
assert.ok(google.includes("recordAuthTelemetry"));

console.log("test-auth-telemetry: OK");

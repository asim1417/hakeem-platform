/**
 * npx tsx scripts/test-resend-from-unify.ts
 */
import assert from "node:assert/strict";
import { DEFAULT_RESEND_FROM, resolveResendFrom } from "../lib/modules/email/send";

assert.equal(DEFAULT_RESEND_FROM, "حكيم <support@hakeemai.net>");

const prev = process.env.RESEND_FROM;
try {
  delete process.env.RESEND_FROM;
  assert.equal(resolveResendFrom(), DEFAULT_RESEND_FROM);

  process.env.RESEND_FROM = "حكيم <onboarding@hakeem.sa>";
  assert.equal(resolveResendFrom(), DEFAULT_RESEND_FROM);

  process.env.RESEND_FROM = "حكيم <support@hakeemai.net>";
  assert.equal(resolveResendFrom(), "حكيم <support@hakeemai.net>");

  process.env.RESEND_FROM = "Hakeem <noreply@hakeemai.net>";
  assert.equal(resolveResendFrom(), "Hakeem <noreply@hakeemai.net>");
} finally {
  if (prev === undefined) delete process.env.RESEND_FROM;
  else process.env.RESEND_FROM = prev;
}

console.log("test-resend-from-unify: OK");

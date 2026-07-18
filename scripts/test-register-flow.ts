/**
 * اختبار منطق بيانات التسجيل (بدون شبكة/قاعدة).
 * التشغيل: npx tsx scripts/test-register-flow.ts
 */
import assert from "node:assert/strict";
import { z } from "zod";
import { generateEasyPassword, generateUsername, isValidUsername } from "../lib/modules/auth/credentials";

const schema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email().optional().or(z.literal("")),
  username: z.string().min(3).max(32).optional().or(z.literal("")),
  password: z.string().min(8).max(72),
  entityType: z.enum(["INDIVIDUAL", "LAW_FIRM", "OTHER"]).default("INDIVIDUAL"),
});

const ok = schema.parse({
  name: "محامٍ تجريبي",
  password: generateEasyPassword(),
  entityType: "INDIVIDUAL",
});
assert.equal(ok.entityType, "INDIVIDUAL");

const u = generateUsername(ok.name);
assert.ok(isValidUsername(u));

assert.throws(() => schema.parse({ name: "أ", password: "short" }));

console.log("test-register-flow: OK");

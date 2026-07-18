/**
 * اختبار توليد اسم المستخدم وكلمة المرور السهلة.
 * التشغيل: npm run test:credentials
 */
import assert from "node:assert/strict";
import {
  emailFromUsername,
  generateEasyPassword,
  generateUsername,
  isValidUsername,
  slugifyUsername,
} from "../lib/modules/auth/credentials";

assert.equal(slugifyUsername("أحمد العتيبي"), "ahmd.alatyby");
assert.ok(isValidUsername("owner.1204"));
assert.equal(isValidUsername("ab"), false);

const u = generateUsername("مالك حكيم");
assert.ok(isValidUsername(u), u);
assert.ok(u.includes("."), u);

const p = generateEasyPassword();
assert.match(p, /^[A-Za-z]+-\d{4}!$/);

assert.equal(emailFromUsername("owner.1204"), "owner.1204@hakeem.local");

console.log("test-credentials: OK");

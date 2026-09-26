/**
 * منطق نموذج الدخول العربي (بريد / جوال برمز).
 * npx tsx scripts/test-identifier-flow.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  arabicErrorMessage,
  GENERIC_ERROR,
  maskIdentifier,
  normalizePhone,
  parseIdentifier,
  pickSecondFactor,
  profileFieldsToCollect,
  sanitizeCode,
  toLatinDigits,
  unsupportedMissingFields,
} from "../lib/modules/auth/identifier-flow";

// الأرقام العربية
assert.equal(toLatinDigits("٠٥٦٨٩٤٩٢٨٢"), "0568949282");
assert.equal(toLatinDigits("۰۵۶۸"), "0568");

// الجوال السعودي بكل الصيغ
for (const input of [
  "0568949282",
  "568949282",
  "966568949282",
  "+966568949282",
  "00966568949282",
  "056 894 9282",
  "٠٥٦٨٩٤٩٢٨٢",
  "+966 (56) 894-9282",
]) {
  assert.equal(normalizePhone(input), "+966568949282", input);
}
assert.equal(normalizePhone("+12025550123"), "+12025550123");
assert.equal(normalizePhone("0012025550123"), "+12025550123");
assert.equal(normalizePhone("12345"), null);
assert.equal(normalizePhone("0468949282"), null); // ليس جوالًا سعوديًا
assert.equal(normalizePhone("abc"), null);

// التمييز بين البريد والجوال
assert.deepEqual(parseIdentifier(" Aasem@Example.com "), { kind: "email", value: "aasem@example.com" });
assert.deepEqual(parseIdentifier("٠٥٦٨٩٤٩٢٨٢"), { kind: "phone", value: "+966568949282" });
assert.equal(parseIdentifier("").kind, "invalid");
assert.equal(parseIdentifier("user@bad").kind, "invalid");
assert.equal(parseIdentifier("hello").kind, "invalid");

// الإخفاء
assert.equal(maskIdentifier({ kind: "phone", value: "+966568949282" }), "+966 ••• 282");
assert.equal(maskIdentifier({ kind: "email", value: "aasem@example.com" }), "aa•••@example.com");

// الرمز
assert.equal(sanitizeCode("١٢٣ ٤٥٦"), "123456");
assert.equal(sanitizeCode("12-34-56-78-90"), "12345678");

// الأخطاء
const clerkErr = (code: string) => ({ errors: [{ code, message: "english" }] });
assert.equal(arabicErrorMessage(clerkErr("form_code_incorrect")), "الرمز غير صحيح. تحقّق منه وأعد المحاولة.");
assert.equal(arabicErrorMessage(clerkErr("form_identifier_not_found")), "لا يوجد حساب بهذا البريد أو الرقم.");
assert.equal(arabicErrorMessage({ status: 429 }), "محاولات كثيرة. انتظر دقيقة ثم أعد المحاولة.");
assert.equal(arabicErrorMessage(clerkErr("something_new")), GENERIC_ERROR);
assert.equal(arabicErrorMessage(new Error("boom")), GENERIC_ERROR);
// الرسائل عربية دائمًا — لا نمرّر نص Clerk الإنجليزي
assert.ok(!/[A-Za-z]{4,}/.test(arabicErrorMessage(clerkErr("form_param_format_invalid"))));

// التحقق الثنائي: تطبيق المصادقة أولًا
assert.equal(pickSecondFactor([{ strategy: "backup_code" }, { strategy: "totp" }]), "totp");
assert.equal(pickSecondFactor([{ strategy: "backup_code" }, { strategy: "phone_code" }]), "phone_code");
assert.equal(pickSecondFactor([{ strategy: "backup_code" }]), "backup_code");
assert.equal(pickSecondFactor([]), null);
assert.equal(pickSecondFactor(null), null);

// إكمال البيانات
assert.deepEqual(profileFieldsToCollect(["email_address", "first_name", "password"]), [
  "first_name",
  "email_address",
  "password",
]);
assert.deepEqual(profileFieldsToCollect(null), []);
assert.deepEqual(unsupportedMissingFields(["email_address", "oauth_google", "phone_number"]), ["oauth_google"]);

// الواجهة: عربية، بلا استيراد ثابت لـ Clerk في الغلاف، ومع captcha و one-time-code
const root = process.cwd();
const shell = fs.readFileSync(path.join(root, "components/auth/AuthIdentifierFlow.tsx"), "utf8");
assert.equal(shell.includes('from "@clerk/nextjs"'), false);
const inner = fs.readFileSync(path.join(root, "components/auth/AuthIdentifierFlowInner.tsx"), "utf8");
assert.ok(inner.includes('id="clerk-captcha"'));
assert.ok(inner.includes('autoComplete="one-time-code"'));
assert.ok(inner.includes("setActive"));
assert.ok(inner.includes("continueUrl"));

console.log("test-identifier-flow: OK");

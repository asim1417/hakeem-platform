/**
 * منطق نموذج الدخول العربي (بريد / جوال برمز).
 * npx tsx scripts/test-identifier-flow.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  arabicErrorMessage,
  CODE_LENGTH,
  GENERIC_ERROR,
  maskIdentifier,
  maskIdentifierLocal,
  normalizePhone,
  parseIdentifier,
  parseIdentifierFor,
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

// التبويبان (المقترح أ): الجوال يقبل الصيغ السعودية والدولية فقط، والبريد بريدًا فقط
assert.deepEqual(parseIdentifierFor("phone", "55 123 4567"), { kind: "phone", value: "+966551234567" });
assert.deepEqual(parseIdentifierFor("phone", "0551234567"), { kind: "phone", value: "+966551234567" });
assert.deepEqual(parseIdentifierFor("phone", "+966551234567"), { kind: "phone", value: "+966551234567" });
assert.deepEqual(parseIdentifierFor("phone", "٥٥١٢٣٤٥٦٧"), { kind: "phone", value: "+966551234567" });
assert.equal(parseIdentifierFor("phone", "a@b.com").kind, "invalid", "email in the phone tab");
assert.equal(parseIdentifierFor("phone", "").kind, "invalid");
assert.deepEqual(parseIdentifierFor("email", " A@Example.com "), { kind: "email", value: "a@example.com" });
assert.equal(parseIdentifierFor("email", "0551234567").kind, "invalid", "phone in the email tab");

// الإخفاء
assert.equal(maskIdentifier({ kind: "phone", value: "+966568949282" }), "+966 ••• 282");
assert.equal(maskIdentifier({ kind: "email", value: "aasem@example.com" }), "aa•••@example.com");

// الرمز
assert.equal(sanitizeCode("١٢٣ ٤٥٦"), "123456");
assert.equal(sanitizeCode("12-34-56-78-90"), "12345678");

// الأخطاء
const clerkErr = (code: string) => ({ errors: [{ code, message: "english" }] });
assert.equal(arabicErrorMessage(clerkErr("form_code_incorrect")), "الرمز غير صحيح. راجع الأرقام وصحّح ما يلزم.");
// لا تكشف الرسائل إن كان الحساب مسجّلًا (منع تعداد الحسابات)
for (const code of ["form_identifier_not_found", "form_identifier_exists", "not_allowed_access"]) {
  const msg = arabicErrorMessage(clerkErr(code));
  assert.notEqual(msg, GENERIC_ERROR, code);
  assert.ok(!/لا يوجد حساب|يوجد حساب|غير مسجّل|مسجّل/.test(msg), `${code} reveals account existence: ${msg}`);
}
assert.equal(arabicErrorMessage({ status: 429 }), "محاولات كثيرة. انتظر دقيقة ثم أعد المحاولة.");
assert.equal(arabicErrorMessage(clerkErr("something_new")), GENERIC_ERROR);
assert.equal(arabicErrorMessage(new Error("boom")), GENERIC_ERROR);
// الرسائل عربية دائمًا — لا نمرّر نص Clerk الإنجليزي
assert.ok(!/[A-Za-z]{4,}/.test(arabicErrorMessage(clerkErr("form_param_format_invalid"))));

assert.equal(CODE_LENGTH, 6);

// إخفاء محلي في صندوق الدخول (الشاشة ٣): 05•• ••• 4567
assert.equal(maskIdentifierLocal({ kind: "phone", value: "+966551234567" }), "05•• ••• 4567");
assert.equal(maskIdentifierLocal({ kind: "phone", value: "+12025550123" }), maskIdentifier({ kind: "phone", value: "+12025550123" }));
assert.equal(maskIdentifierLocal({ kind: "email", value: "aasem@example.com" }), "aa•••@example.com");

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
assert.ok(inner.includes("/api/auth/claim-clerk-session"), "must claim hakeem_session after Clerk sign-in");
const claimRoute = fs.readFileSync(path.join(root, "app/api/auth/claim-clerk-session/route.ts"), "utf8");
assert.ok(claimRoute.includes("claimSessionFromClerkReturn") && claimRoute.includes("attachLoginSessionCookie"));
assert.ok(claimRoute.includes('request.headers.get("origin")'), "claim route must be same-origin only");
const mw = fs.readFileSync(path.join(root, "middleware.ts"), "utf8");
assert.ok(mw.includes("/api/auth/claim-clerk-session"));

// الوصول: خطأ مربوط بالحقل، وعلامات الإلزام، وتسمية ظاهرة للرمز
assert.ok(inner.includes("aria-invalid"), "fields expose aria-invalid on error");
assert.ok(inner.includes('ERROR_ID = "hakeem-auth-error"') && inner.includes("aria-describedby"));
assert.ok(inner.includes('aria-required="true"'));
assert.ok(inner.includes("الحقول المعلّمة بـ"), "required-fields note");
assert.equal(/htmlFor="hakeem-code" className="sr-only"/.test(inner), false, "code label must be visible");
assert.equal(inner.includes("rgba(14,52,53,0.18)"), false, "input border uses --auth-input-border");

// embedded / onComplete: اختياريان، وغيابهما = السلوك السابق (انتقال كامل بعد التثبيت)
assert.ok(/embedded = false/.test(inner), "embedded defaults to false");
assert.ok(/onComplete\?: \(result: IdentifierFlowResult\) => void/.test(inner));
assert.ok(
  /if \(onComplete\) \{[\s\S]{0,800}?onComplete\(\{ ok: true, next \}\);\s*return;\s*\}\s*[\s\S]{0,500}?window\.location\.assign\(next\)/.test(inner),
  "with onComplete: report result; without it: hard-assign only after a successful claim"
);
assert.ok(
  inner.includes("تم التحقق من الرمز، لكن تعذّر فتح مساحة العمل") &&
    inner.includes("retryClaimAfterCode") &&
    !inner.includes('showError("تعذّر إكمال الدخول. حاول مرة أخرى.", "identifier")'),
  "failed claim keeps the verified code session and offers retry — does not dump to public home"
);
assert.ok(!inner.includes('pattern="[0-9]*"'));
assert.ok(!fs.readFileSync(path.join(root, "components/auth/CodeInput.tsx"), "utf8").includes('pattern="[0-9]*"'), "Arabic digits must not be blocked by pattern");
assert.ok(inner.includes("<CodeInput") && /embedded &&\s*\(s\.name === "code"/.test(inner), "segmented code input only in embedded mode");
// الشاشة ٣: حقل واحد خلف ست خانات، fieldset/legend، إرسال تلقائي 200–300ms
const codeInput = fs.readFileSync(path.join(root, "components/auth/CodeInput.tsx"), "utf8");
for (const attr of ['type="text"', 'inputMode="numeric"', 'autoComplete="one-time-code"', "maxLength={CODE_LENGTH}"]) {
  assert.ok(codeInput.includes(attr), `code input: ${attr}`);
}
assert.equal((codeInput.match(/<input\b/g) || []).length, 1, "one real input behind the six boxes");
assert.ok(codeInput.includes("<fieldset") && codeInput.includes("<legend") && codeInput.includes("رمز التحقق (٦ أرقام)"));
assert.ok(codeInput.includes("aria-invalid") && codeInput.includes("aria-describedby"));
assert.ok(/CODE_AUTOSUBMIT_DELAY_MS = (2\d\d|300);/.test(codeInput), "auto-submit within 200–300ms");
assert.ok(codeInput.includes("onPaste") && codeInput.includes("sanitizeCode(text)"), "paste fills all boxes");
assert.equal(codeInput.includes("@clerk"), false);
// الشاشة ٦: الخطأ يحفظ الأرقام، ورسالة تحت الخانات، و«أرسل رمزًا جديدًا»
assert.ok(inner.includes("الشاشة ٦: الأرقام تبقى كما هي"));
assert.equal(/fail\(err\);\s*if \(showsCodeBoxes\(step\)\)/.test(inner), false, "digits are not cleared on error");
assert.ok(inner.includes("أرسل رمزًا جديدًا") && inner.includes("لم يصلك الرمز؟") && inner.includes("تعديل الرقم"));
assert.ok(inner.includes("أرسلناه برسالة نصية إلى"));
// صفحة /auth/identifier لا تمرّر embedded ولا onComplete
const idPage = fs.readFileSync(path.join(root, "app/auth/identifier/page.tsx"), "utf8");
assert.equal(/embedded|onComplete/.test(idPage), false);

console.log("test-identifier-flow: OK");

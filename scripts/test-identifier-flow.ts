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
  fillCodeBoxes,
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

// خانات الرمز: كتابة، لصق كامل في أي خانة، أرقام عربية، مسح
assert.equal(CODE_LENGTH, 6);
const empty = ["", "", "", "", "", ""];
assert.deepEqual(fillCodeBoxes(empty, 0, "4"), { digits: ["4", "", "", "", "", ""], focus: 1 });
assert.deepEqual(fillCodeBoxes(empty, 3, "123456"), { digits: ["1", "2", "3", "4", "5", "6"], focus: 5 });
assert.deepEqual(fillCodeBoxes(empty, 0, "١٢٣ ٤٥٦"), { digits: ["1", "2", "3", "4", "5", "6"], focus: 5 });
assert.deepEqual(fillCodeBoxes(["1", "2", "", "", "", ""], 2, "34"), { digits: ["1", "2", "3", "4", "", ""], focus: 4 });
assert.deepEqual(fillCodeBoxes(["1", "2", "3", "", "", ""], 1, ""), { digits: ["1", "", "3", "", "", ""], focus: 1 });
assert.deepEqual(fillCodeBoxes(empty, 5, "98"), { digits: ["", "", "", "", "", "9"], focus: 5 });

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
  /if \(onComplete\) \{\s*onComplete\(\{ ok: Boolean\(next\), next: next \?\? nextUrl \}\);\s*return;\s*\}\s*[\s\S]{0,160}window\.location\.assign\(next \?\? nextUrl\)/.test(inner),
  "without onComplete the flow still navigates; with it, no navigation"
);
assert.ok(inner.includes("<CodeBoxes") && /embedded &&\s*\(s\.name === "code"/.test(inner), "code boxes only in embedded mode");
const boxes = fs.readFileSync(path.join(root, "components/auth/CodeBoxes.tsx"), "utf8");
assert.ok(boxes.includes('autoComplete={i === 0 ? "one-time-code" : "off"}'));
assert.ok(boxes.includes('inputMode="numeric"'));
assert.ok(boxes.includes("onFilled(next.join(\"\"))"), "auto-verify when all boxes are filled");
assert.equal(boxes.includes("@clerk"), false);
// صفحة /auth/identifier لا تمرّر embedded ولا onComplete
const idPage = fs.readFileSync(path.join(root, "app/auth/identifier/page.tsx"), "utf8");
assert.equal(/embedded|onComplete/.test(idPage), false);

console.log("test-identifier-flow: OK");

/**
 * حساب الجوال وحده (بلا بريد في Clerk) يُثبَّت له hakeem_session بمعرّف داخلي ثابت،
 * ولا يُعلَن «تم التحقق» قبل تأكيد الخادم.
 * npx tsx scripts/test-clerk-phone-only.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  clerkUserRealEmail,
  isPhoneOnlyLocalEmail,
  localEmailForClerkUser,
  phoneOnlyLocalEmail,
} from "@/lib/modules/auth/clerk-local-email";

const read = (p: string) => readFileSync(p, "utf8");

// ── المعرّف الداخلي ──
const a = phoneOnlyLocalEmail("user_2AbCdEf");
assert.equal(a, phoneOnlyLocalEmail("user_2AbCdEf"), "ثابت لنفس clerkId");
assert.notEqual(a, phoneOnlyLocalEmail("user_2abcdef"), "لا يتصادم عند اختلاف الحالة");
assert.match(a, /^u-[0-9a-f]{32}@phone\.hakeemai\.invalid$/);
assert.equal(a, a.toLowerCase(), "صغير الحروف (provisionOAuthUser يحوّل البريد إلى الصغير)");
assert.ok(!a.includes("2AbCdEf"), "لا يكشف clerkId");
assert.ok(isPhoneOnlyLocalEmail(a));
assert.ok(isPhoneOnlyLocalEmail(a.toUpperCase()));
assert.ok(!isPhoneOnlyLocalEmail("name@example.com"));
assert.ok(!isPhoneOnlyLocalEmail(null));

// ── البريد الحقيقي يغلب ──
assert.equal(
  localEmailForClerkUser({ id: "user_1", primaryEmailAddress: { emailAddress: "a@b.co" }, emailAddresses: [] }),
  "a@b.co"
);
assert.equal(localEmailForClerkUser({ id: "user_1", emailAddresses: [{ emailAddress: "x@y.co" }] }), "x@y.co");
assert.equal(clerkUserRealEmail({ id: "user_1", primaryEmailAddress: null, emailAddresses: [] }), "");
assert.equal(localEmailForClerkUser({ id: "user_1", primaryEmailAddress: null, emailAddresses: [] }), phoneOnlyLocalEmail("user_1"));

// ── الخادم لا يرفض حساب الجوال وحده ──
const claim = read("lib/modules/auth/claim-clerk-return.ts");
assert.ok(claim.includes("localIdentity(u)"), "claim يستعمل الهوية المحلية");
assert.ok(!/if \(!email\) return null;/.test(claim), "لا رفض لغياب البريد في claim");
const session = read("lib/modules/auth/session.ts");
assert.ok(session.includes("localEmailForClerkUser(cu)"), "resolveClerkUser يقبل حساب الجوال");
assert.ok(!/if \(!email\) return null;/.test(session.slice(session.indexOf("async function resolveClerkUser"))));

// ── لا «تم التحقق» قبل التأكيد، ولا انتقال إلى مسار محمي عند الفشل ──
const dialog = read("components/home/HomeAuthDialog.tsx");
assert.ok(dialog.includes("const confirmed = view.name === \"verified\""));
assert.ok(dialog.includes("showVerified && !confirmed") && dialog.includes("جارٍ إكمال الدخول…"));
assert.ok(!dialog.includes("window.location.assign(result.next)"), "لا انتقال عند فشل التثبيت");
const inner = read("components/auth/AuthIdentifierFlowInner.tsx");
assert.ok(inner.includes('showError("تعذّر إكمال الدخول. حاول مرة أخرى.", "identifier")'));
assert.ok(inner.includes("onComplete({ ok: true, next })"));

console.log("clerk phone-only: OK");

// ── لا رسالة ترحيب إلى المعرّف الداخلي ──
assert.ok(read("lib/modules/onboarding/bootstrap.ts").includes("!isPhoneOnlyLocalEmail(user.email)"));
console.log("clerk phone-only (welcome): OK");

// ── كل دخول: رقم أو بريد ← رمز ← الصفحة الداخلية (لا دخول بلا رمز من جلسة Clerk متبقية) ──
{
  const src = read("components/auth/AuthIdentifierFlowInner.tsx");
  const submit = src.slice(src.indexOf("function submitIdentifier"));
  assert.ok(/await endStaleClerkSessions\(\);\s*try \{\s*await startSignIn/.test(submit), "إنهاء الجلسة المتبقية قبل إرسال الرمز");
  assert.ok(src.includes("s.end()"), "end() بلا انتقال — لا signOut");
  const run = src.slice(src.indexOf("async function run("), src.indexOf("function submitIdentifier"));
  assert.ok(!run.includes("claimAndNavigate"), "session_exists لا يُدخل المستخدم بلا رمز");
  console.log("clerk phone-only (always a code): OK");
}

// ── سبب رفض claim يظهر في السجلات (المرحلة والرمز فقط)، والتحقق يجرّب مفتاح Vercel إن استُبدل ──
{
  const src = read("lib/modules/auth/claim-clerk-return.ts");
  for (const stage of ['"verify"', '"no_sub"', '"get_user"', '"establish"']) assert.ok(src.includes(`logClaimFailure(${stage}`), stage);
  const log = src.slice(src.indexOf("function logClaimFailure"));
  assert.ok(!/sessionJwt|email|phone|userId|\.id\b/.test(log), "لا بيانات حساسة في السجل");
  assert.ok(log.includes(".slice(0, 8)"), "نوع المفتاح (البادئة) فقط، لا المفتاح");
  assert.ok(src.includes("new Set([secretKey, ENV_SECRET_AT_LOAD]"), "تجربة مفتاح Vercel الأصلي");
  assert.ok(src.includes("return await establishFirstPartySession("), "خطأ التثبيت يُلتقط ويُسجَّل");
  console.log("clerk phone-only (claim diagnostics): OK");
}

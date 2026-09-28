/**
 * دخول بلا ومضة صفحة خاطئة — حراسة الإحالات قبل الرسم.
 * npx tsx scripts/test-entry-no-wrong-flash.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(root, rel), "utf8");

const mw = read("middleware.ts");
const loading = read("app/loading.tsx");
const continuePage = read("app/auth/continue/page.tsx");
const dialog = read("components/home/HomeAuthDialog.tsx");
const safeNext = read("lib/modules/auth/safe-next.ts");

// إحالات قبل الرسم — لا محتوى تسويقي ثم تحويل
assert.ok(mw.includes("workspaceHome(request)"), "وجهة من دور الجلسة قبل الرسم");
assert.ok(mw.includes("307"), "307 لصاحب الجلسة على /");
assert.ok(mw.includes("singleSignInTarget"), "مداخل قديمة → /sign-in قبل الرسم");

// لا نص «جارٍ التحميل…» يومض على الجذر
assert.equal(loading.includes("جارٍ التحميل…"), false);
assert.ok(loading.includes("aria-busy"));

// بعد OAuth: شاشة انتظار محايدة لا فشل كاذب سريع
assert.ok(continuePage.includes("AuthContinueClient"));
assert.ok(dialog.includes("window.location.assign(dest)"));
assert.equal(dialog.includes("router.push(dest)"), false);

// التسجيل المباشر بدون /sign-up وسيط
assert.ok(safeNext.includes("/sign-in?mode=sign-up&next="));

console.log("test-entry-no-wrong-flash: OK");

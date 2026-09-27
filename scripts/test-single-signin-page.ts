/**
 * صفحة دخول واحدة: ‎/sign-in‎ تعرض صندوق الرئيسية نفسه (Google + تبويبا الجوال/البريد + الرمز)،
 * وبقية المداخل تُحال إليها. بعد التحقق: الصفحة الداخلية (‎next‎)، لا صفحة دخول أخرى.
 * npx tsx scripts/test-single-signin-page.ts
 */
import "./helpers/ignore-css";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { SignInPagePanel } from "../components/auth/SignInPagePanel";
import type { HomeAuthConfig } from "../components/home/HomeAuthLauncher";
import { singleSignInTarget } from "../lib/modules/auth/single-sign-in";

(globalThis as { React?: typeof React }).React = React;

const read = (p: string) => fs.readFileSync(p, "utf8");
const router = { push() {}, replace() {}, refresh() {}, back() {}, forward() {}, prefetch() {} };
const config: HomeAuthConfig = { providers: ["google", "email", "phone"], identifierForm: true, publishableKey: "pk_test_x", hideDevelopmentMode: true };

function render(mode: "sign-in" | "sign-up", nextUrl = "/dashboard") {
  return renderToStaticMarkup(
    createElement(AppRouterContext.Provider, { value: router as never }, createElement(SignInPagePanel, { config, mode, nextUrl }))
  );
}

// ── الصفحة: الصندوق نفسه، بلا حوار ولا إغلاق ──
{
  const html = render("sign-in");
  assert.ok(html.includes("hk-home-auth__panel--page"));
  assert.equal(/role="dialog"/.test(html), false, "ليست نافذة");
  assert.equal(html.includes('aria-label="إغلاق"'), false, "لا زر إغلاق");
  assert.ok(/<h1[^>]*>أهلًا بعودتك<\/h1>/.test(html), "عنوان الصفحة h1");
  assert.ok(html.includes("المتابعة باستخدام Google"));
  assert.ok(html.includes('class="hk-idf__tabs"'), "تبويبا الجوال/البريد مباشرة في الصفحة");
  assert.ok(/aria-pressed="true"[^>]*>[\s\S]*?رقم الجوال/.test(html), "الجوال افتراضي");
  assert.ok(html.includes("+966") && html.includes("أرسل الرمز"));
  assert.equal(html.includes("المتابعة بالبريد الإلكتروني أو رقم الجوال"), false, "لا زر وسيط إلى صفحة أخرى");
  assert.ok(html.includes("/api/auth/google?next=%2Fdashboard"), "Google يعود إلى الوجهة الداخلية");
}
assert.ok(/<h1[^>]*>ابدأ مع حكيم<\/h1>/.test(render("sign-up")));
assert.ok(render("sign-in", "/dashboard/cases").includes("next=%2Fdashboard%2Fcases"), "الوجهة المطلوبة تُحفظ");

// ── بعد التحقق: الوجهة من ‎next‎ فقط، والاحتياط يقارن بمسار البداية لا بـ «/» ──
const dialog = read("components/home/HomeAuthDialog.tsx");
assert.ok(dialog.includes("const current = page ? intent : readHomeAuthIntent() ?? intent;"));
assert.ok(dialog.includes("window.location.assign(dest)"), "انتقال كامل إلى الداخلية بعد التحقق");
assert.ok(dialog.includes('onAuthenticated("identifier", result.next)'), "وجهة الخادم بعد claim تُحترم");
assert.equal(dialog.includes("router.push(dest)"), false);

// ── المداخل كلها إلى ‎/sign-in‎: 307 في الـ middleware، والوجهة محفوظة وآمنة ──
assert.equal(singleSignInTarget("/sign-up", new URLSearchParams("next=/dashboard/cases")), "/sign-in?mode=sign-up&next=%2Fdashboard%2Fcases");
assert.equal(singleSignInTarget("/sign-up/verify", new URLSearchParams()), "/sign-in?mode=sign-up");
assert.equal(singleSignInTarget("/register", new URLSearchParams("ref=x")), "/sign-in?mode=sign-up");
assert.equal(singleSignInTarget("/login", new URLSearchParams("returnUrl=/dashboard/files")), "/sign-in?next=%2Fdashboard%2Ffiles");
assert.equal(singleSignInTarget("/auth/identifier", new URLSearchParams("mode=sign-up&next=/dashboard")), "/sign-in?mode=sign-up&next=%2Fdashboard");
assert.equal(singleSignInTarget("/auth/identifier", new URLSearchParams("next=https://evil.example")), "/sign-in?next=%2Fdashboard", "وجهة خارجية ← ‎/dashboard‎");
assert.equal(singleSignInTarget("/sign-in", new URLSearchParams()), null, "لا حلقة");
assert.equal(singleSignInTarget("/auth/continue", new URLSearchParams()), null);
assert.equal(singleSignInTarget("/dashboard", new URLSearchParams()), null);
const mw = read("middleware.ts");
assert.ok(/if \(isHomeInlineAuthEnabled\(\)\) \{\s*const target = singleSignInTarget\(/.test(mw), "الإحالة خلف مفتاح الطوارئ");
assert.ok(mw.indexOf("singleSignInTarget(request") < mw.indexOf("if (!isClerkConfigured())"), "قبل Clerk");

const signIn = read("app/sign-in/[[...sign-in]]/page.tsx");
assert.ok(signIn.includes("SignInPagePanel") && signIn.includes("isHomeInlineAuthEnabled()"));
assert.ok(signIn.includes("AuthOauthButtons"), "البوابة السابقة احتياط مفتاح الطوارئ فقط");
// الصفحات السابقة باقية لمفتاح الطوارئ، ومع الراية تُحال (احتياط لما بعد الـ middleware)
const signUp = read("app/sign-up/[[...sign-up]]/page.tsx");
assert.ok(/if \(isHomeInlineAuthEnabled\(\)\) \{\s*redirect\(`\/sign-in\?/.test(signUp) && signUp.includes("AuthOauthButtons"));
const identifier = read("app/auth/identifier/page.tsx");
assert.ok(/if \(isHomeInlineAuthEnabled\(\)\) \{[\s\S]{0,160}redirect\(`\/sign-in\?/.test(identifier));

console.log("single sign-in page: OK");

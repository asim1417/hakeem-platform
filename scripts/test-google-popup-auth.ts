/**
 * اختبار توثيق Google OAuth عبر النوافذ المنبثقة (Popup Window + postMessage).
 * npx tsx scripts/test-google-popup-auth.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { GOOGLE_POPUP_COOKIE } from "../lib/modules/auth/google-oauth";

const root = process.cwd();

// 1. ثوابت الكوكيز
assert.equal(GOOGLE_POPUP_COOKIE, "hakeem_g_popup");

// 2. فحص أداة النوافذ المنبثقة للعميل
const popupUtil = fs.readFileSync(path.join(root, "lib/modules/auth/oauth-popup.ts"), "utf8");
assert.ok(popupUtil.includes("openOAuthPopup"));
assert.ok(popupUtil.includes("hakeem_oauth_success"));
assert.ok(popupUtil.includes("hakeem_oauth_error"));
assert.ok(popupUtil.includes("window.open"));
assert.ok(popupUtil.includes("postMessage") || popupUtil.includes("addEventListener"));

// 3. مسار بدء التوثيق /api/auth/google
const googleRoute = fs.readFileSync(path.join(root, "app/api/auth/google/route.ts"), "utf8");
assert.ok(googleRoute.includes("GOOGLE_POPUP_COOKIE"));
assert.ok(googleRoute.includes("popup"));

// 4. مسار العودة /api/auth/callback/google
const callbackRoute = fs.readFileSync(
  path.join(root, "app/api/auth/callback/google/route.ts"),
  "utf8"
);
assert.ok(callbackRoute.includes("GOOGLE_POPUP_COOKIE"));
assert.ok(callbackRoute.includes("hakeem_oauth_success"));
assert.ok(callbackRoute.includes("hakeem_oauth_error"));
assert.ok(callbackRoute.includes("window.opener.postMessage"));
assert.ok(callbackRoute.includes("window.close()"));

// 5. أزرار تسجيل الدخول AuthOauthButtons
const buttons = fs.readFileSync(path.join(root, "components/auth/AuthOauthButtons.tsx"), "utf8");
assert.ok(buttons.includes('"use client"'));
assert.ok(buttons.includes("openOAuthPopup"));
assert.ok(buttons.includes("popup=1"));
assert.ok(buttons.includes("المتابعة باستخدام Google"));
assert.ok(buttons.includes("handleGoogleClick"));

// 6. نموذج الدخول LoginForm
const loginForm = fs.readFileSync(path.join(root, "components/LoginForm.tsx"), "utf8");
assert.ok(loginForm.includes("openOAuthPopup"));
assert.ok(loginForm.includes("popup=1"));

console.log("test-google-popup-auth: OK");

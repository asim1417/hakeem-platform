/**
 * إخفاء بند التحقق الثنائي من قائمة الحساب عندما AUTH_MFA_ENABLED ≠ 1.
 * npx tsx scripts/test-hide-mfa-account-menu.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { getAccountSecurityFeatures } from "../lib/modules/auth/auth-providers";

const root = process.cwd();
const shell = fs.readFileSync(path.join(root, "components/AppShell.tsx"), "utf8");
const menu = fs.readFileSync(path.join(root, "components/AccountMenu.tsx"), "utf8");
const settings = fs.readFileSync(path.join(root, "lib/modules/settings/settings-service.ts"), "utf8");

assert.ok(shell.includes("hydrateEnvFromSettingsThrottled"), "قائمة الحساب تقرأ الإعدادات المُدارة");
assert.ok(shell.includes("securityFeatures={securityFeatures}"), "تمرير الميزات بعد التحميل");
assert.ok(menu.includes("securityFeatures?.mfa"), "البند مشروط بعلم MFA");
assert.ok(settings.includes('key: "AUTH_MFA_ENABLED"') && settings.includes('placeholder: "0"'), "الافتراضي المقترح مخفي");

delete process.env.AUTH_MFA_ENABLED;
delete process.env.NEXT_PUBLIC_AUTH_MFA_ENABLED;
assert.equal(getAccountSecurityFeatures().mfa, false, "بدون علم = مخفي");

process.env.AUTH_MFA_ENABLED = "0";
assert.equal(getAccountSecurityFeatures().mfa, false, "0 = مخفي");

process.env.AUTH_MFA_ENABLED = "1";
// يحتاج ClerkConfigured — إن لم يُضبط يبقى false؛ لا نفرض true هنا
delete process.env.AUTH_MFA_ENABLED;

console.log("test-hide-mfa-account-menu: OK");

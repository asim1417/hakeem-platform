/**
 * بوابة الدخول معزولة عن تقييم @clerk/nextjs الثابت + error boundaries محلية.
 * npx tsx scripts/test-signin-iphone-isolation.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const noStaticClerk = [
  "components/auth/AuthClerkSignIn.tsx",
  "components/auth/AuthClerkSignUp.tsx",
  "components/auth/AuthOauthOnly.tsx",
  "components/auth/SsoCallbackClient.tsx",
  "components/providers/ClerkAppProvider.tsx",
];

for (const rel of noStaticClerk) {
  const src = fs.readFileSync(path.join(root, rel), "utf8");
  assert.equal(
    src.includes('from "@clerk/nextjs"'),
    false,
    `${rel} must not statically import @clerk/nextjs`
  );
}

const inner = fs.readFileSync(path.join(root, "components/auth/AuthOauthOnlyInner.tsx"), "utf8");
assert.ok(inner.includes('from "@clerk/nextjs"'));

const buttons = fs.readFileSync(path.join(root, "components/auth/AuthOauthButtons.tsx"), "utf8");
assert.ok(buttons.includes("المتابعة باستخدام Google"));
assert.ok(buttons.includes("المتابعة باستخدام Apple"));
assert.ok(buttons.includes("embedded"));
assert.ok(buttons.includes("listVisibleAuthProviders"));
assert.equal(buttons.includes("@clerk/nextjs"), false);

const globalError = fs.readFileSync(path.join(root, "app/global-error.tsx"), "utf8");
assert.ok(globalError.includes("تعذّر فتح الصفحة"));
assert.ok(globalError.includes("حدث خطأ غير متوقع أثناء تحميل الصفحة"));
assert.ok(globalError.includes("العودة إلى الرئيسية"));
assert.equal(globalError.includes('href="/sign-in"'), false);

for (const rel of ["app/sign-in/error.tsx", "app/sign-up/error.tsx", "app/sso-callback/error.tsx"]) {
  assert.ok(fs.existsSync(path.join(root, rel)), `missing ${rel}`);
}

const signInError = fs.readFileSync(path.join(root, "app/sign-in/error.tsx"), "utf8");
assert.ok(signInError.includes("AuthGatewayFailCard"));

const layout = fs.readFileSync(path.join(root, "app/layout.tsx"), "utf8");
assert.equal(layout.includes('from "@/components/providers/ClerkRoot"'), false);
assert.equal(layout.includes('from "@/components/providers/ClerkAppProvider"'), false);

const home = fs.readFileSync(path.join(root, "components/home/HomeHero.tsx"), "utf8");
assert.equal(home.includes('from "next/link"'), false);
assert.equal(home.includes("AuthOauthButtons"), false);
assert.ok(home.includes('href="/sign-in"'));
assert.equal(home.includes("@clerk"), false);

console.log("test-signin-iphone-isolation: OK");

/**
 * npx tsx scripts/test-home-google-signin.ts
 * التحقق من ظهور زر Google مباشرة في الرئيسية مع نافذة منبثقة.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const hero = readFileSync(resolve(root, "components/home/HomeHero.tsx"), "utf8");
const btn = readFileSync(resolve(root, "components/home/HomeGoogleSignIn.tsx"), "utf8");

assert.ok(hero.includes("HomeGoogleSignIn"), "الرئيسية تستورد زر Google");
assert.ok(hero.includes("خيارات أخرى") || hero.includes("خيارات دخول أخرى"), "رابط بديل للبريد موجود");
assert.ok(hero.includes("/sign-in"), "رابط /sign-in يبقى كخيار ثانوي");

assert.ok(btn.includes("openOAuthPopup"), "يستخدم النافذة المنبثقة");
assert.ok(btn.includes("popup=1"), "يفتح Google بوضع popup");
assert.ok(btn.includes("/api/auth/google"), "مسار Google الصحيح");
assert.ok(btn.includes("use client"), "مكوّن عميل");

console.log("test-home-google-signin: OK");

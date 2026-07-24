/**
 * اختبار أصل الموقع الموحّد.
 * npx tsx scripts/test-site-url.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  absoluteUrl,
  DEFAULT_SITE_URL,
  getSiteHost,
  getSiteUrl,
} from "../lib/modules/config/site-url";

const root = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(root, rel), "utf8");

const prevPublic = process.env.NEXT_PUBLIC_SITE_URL;
const prevNextAuth = process.env.NEXTAUTH_URL;

delete process.env.NEXT_PUBLIC_SITE_URL;
delete process.env.NEXTAUTH_URL;
assert.equal(DEFAULT_SITE_URL, "https://hakeem-platform.vercel.app");
assert.equal(getSiteUrl(), DEFAULT_SITE_URL);
assert.equal(absoluteUrl("/legal"), `${DEFAULT_SITE_URL}/legal`);
assert.equal(absoluteUrl("/"), DEFAULT_SITE_URL);
assert.equal(getSiteHost(), "hakeem-platform.vercel.app");

process.env.NEXT_PUBLIC_SITE_URL = "https://hakeemsa.com/";
assert.equal(getSiteUrl(), "https://hakeemsa.com");
assert.equal(absoluteUrl("/pricing"), "https://hakeemsa.com/pricing");
assert.equal(getSiteHost(), "hakeemsa.com");

process.env.NEXT_PUBLIC_SITE_URL = "hakeemsa.com";
assert.equal(getSiteUrl(), "https://hakeemsa.com");

const siteMod = read("lib/modules/config/site-url.ts");
assert.ok(siteMod.includes("NEXT_PUBLIC_SITE_URL"));
assert.ok(siteMod.includes("DEFAULT_SITE_URL"));

const envExample = read(".env.example");
assert.ok(envExample.includes("NEXT_PUBLIC_SITE_URL"));

const layout = read("app/layout.tsx");
assert.ok(layout.includes("metadataBase"));
assert.ok(layout.includes("site-url"));

const nextCfg = read("next.config.mjs");
assert.ok(nextCfg.includes("NEXT_PUBLIC_SITE_URL"));
assert.ok(nextCfg.includes("*.clerk.accounts.dev"), "Clerk CSP hosts must remain");
assert.ok(nextCfg.includes("clerk.shared.lcl.dev"), "Clerk lcl.dev must remain");

for (const rel of [
  "app/sitemap.ts",
  "app/robots.ts",
  "app/llms.txt/route.ts",
  "app/developers/page.tsx",
  "app/legal/[slug]/[article]/page.tsx",
  "app/admin/settings/page.tsx",
  "lib/modules/support/notify.ts",
  "lib/modules/email/send.ts",
  "lib/modules/referrals/codes.ts",
]) {
  const src = read(rel);
  assert.equal(
    src.includes('"https://hakeem-platform.vercel.app"'),
    false,
    `${rel} must not hardcode site URL string literal`
  );
  assert.ok(
    src.includes("getSiteUrl") || src.includes("absoluteUrl") || src.includes("site-url"),
    rel
  );
}

const legal = read("app/legal/page.tsx");
assert.ok(legal.includes("absoluteUrl") || legal.includes("getSiteUrl"));
assert.equal(legal.includes('"https://hakeem-platform.vercel.app/legal"'), false);

const adminSettings = read("app/admin/settings/page.tsx");
assert.ok(adminSettings.includes("absoluteUrl"));
assert.equal(adminSettings.includes("hakeem-platform.vercel.app"), false);

if (prevPublic === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
else process.env.NEXT_PUBLIC_SITE_URL = prevPublic;
if (prevNextAuth === undefined) delete process.env.NEXTAUTH_URL;
else process.env.NEXTAUTH_URL = prevNextAuth;

console.log("test-site-url: OK");

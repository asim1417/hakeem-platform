/**
 * Clerk خارج الصفحة العامة.
 * npx tsx scripts/test-clerk-off-home.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const layout = fs.readFileSync(path.join(root, "app/layout.tsx"), "utf8");
assert.equal(layout.includes('from "@/components/providers/ClerkAppProvider"'), false);
assert.equal(layout.includes('from "@/components/providers/ClerkRoot"'), false);
assert.ok(layout.includes("BootWatchdog"));

const clerkRoot = fs.readFileSync(path.join(root, "components/providers/ClerkRoot.tsx"), "utf8");
assert.ok(clerkRoot.includes("ClerkAppProvider"));

for (const rel of [
  "app/sign-in/layout.tsx",
  "app/sign-up/layout.tsx",
  "app/sso-callback/layout.tsx",
  "app/auth/layout.tsx",
  "app/dashboard/layout.tsx",
  "app/admin/layout.tsx",
  "app/onboarding/layout.tsx",
  "app/audit-logs/layout.tsx",
  "app/documents/layout.tsx",
]) {
  const src = fs.readFileSync(path.join(root, rel), "utf8");
  assert.ok(src.includes("ClerkRoot"), `missing ClerkRoot in ${rel}`);
}

const docs = fs.readFileSync(path.join(root, "app/documents/layout.tsx"), "utf8");
assert.ok(docs.includes("ServiceExitBar"));
assert.ok(docs.includes("ConversionIndicator"));

const home = fs.readFileSync(path.join(root, "components/home/HomeHero.tsx"), "utf8");
assert.equal(home.includes("@clerk"), false);

console.log("test-clerk-off-home: OK");

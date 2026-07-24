/**
 * Must-haves لتشغيل الأدمن: بلاغات + سجل مدفوعات + عزل إعدادات + health.
 * npx tsx scripts/test-admin-ops-musthaves.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(root, rel), "utf8");

const mustExist = [
  "app/admin/reports/page.tsx",
  "app/api/health/route.ts",
  "lib/modules/billing/billing-events.ts",
  "app/api/billing/webhook/route.ts",
];
for (const f of mustExist) {
  assert.ok(fs.existsSync(path.join(root, f)), `missing ${f}`);
}

const nav = read("components/admin/AdminNav.tsx");
assert.ok(nav.includes('href: "/admin/reports"'), "super nav needs reports");
const systemBlock = nav.split("const SYSTEM_LINKS")[1] || "";
assert.ok(!systemBlock.includes('"/admin/settings"'), "SYSTEM must not see settings");
assert.ok(!systemBlock.includes('"/admin/ai"'), "SYSTEM must not see ai");
assert.ok(!systemBlock.includes('"/admin/reports"'), "SYSTEM must not see reports");
assert.ok(!systemBlock.includes('"/admin/billing"'), "SYSTEM must not see billing");

for (const rel of [
  "app/admin/settings/page.tsx",
  "app/admin/ai/page.tsx",
  "app/admin/reports/page.tsx",
  "app/admin/billing/page.tsx",
]) {
  const src = read(rel);
  assert.ok(src.includes("requireSuperAdminPage"), `${rel} must gate super`);
  assert.ok(src.includes("AdminPageShell"), `${rel} must use AdminPageShell`);
}

const settingsApi = read("app/api/admin/settings/route.ts");
assert.ok(settingsApi.includes("requireSuperAdminApi"));
assert.equal(settingsApi.includes("requireApiPermission"), false);

const aiApi = read("app/api/admin/ai-settings/route.ts");
assert.ok(aiApi.includes("requireSuperAdminApi"));

const bugGet = read("app/api/original-hakeem/bug-report/route.ts");
assert.ok(bugGet.includes("requireSuperAdminApi"));
assert.ok(bugGet.includes('requireApiPermission("SIMULATIONS_USE"'));

const events = read("lib/modules/billing/billing-events.ts");
assert.ok(events.includes("billing_events"));
assert.ok(events.includes("recordBillingEvent"));
assert.ok(events.includes("listRecentBillingEvents"));
assert.ok(events.includes("verifyMoyasarWebhookSecret"));
assert.ok(events.includes("ON CONFLICT"));

const webhook = read("app/api/billing/webhook/route.ts");
assert.ok(webhook.includes("verifyMoyasarWebhookSecret"));
assert.ok(webhook.includes("recordBillingEvent"));
assert.ok(webhook.includes("recorded.inserted"));

const billingPage = read("app/admin/billing/page.tsx");
assert.ok(billingPage.includes("listRecentBillingEvents"));
assert.ok(billingPage.includes("سجل مدفوعات"));

const health = read("app/api/health/route.ts");
assert.ok(health.includes("database"));
assert.ok(health.includes("hakeem-platform"));
assert.ok(!health.includes("SECRET"));
assert.ok(!health.includes("process.env."));

const managed = read("lib/modules/settings/settings-service.ts");
assert.ok(managed.includes("MOYASAR_WEBHOOK_SECRET"));

const overview = read("app/admin/page.tsx");
assert.ok(overview.includes('href="/admin/reports"'));
// قسم مدير النظام لا يوجّه لإعدادات/ذكاء السوبر
const systemOverview = overview.split("مدير النظام")[1] || overview.split("Legacy")[1] || "";
if (systemOverview) {
  assert.ok(!systemOverview.includes('href="/admin/settings"'));
  assert.ok(!systemOverview.includes('href="/admin/ai"'));
}

async function assertWebhookSecret() {
  const { verifyMoyasarWebhookSecret } = await import(
    "../lib/modules/billing/billing-events"
  );
  const prev = process.env.MOYASAR_WEBHOOK_SECRET;
  delete process.env.MOYASAR_WEBHOOK_SECRET;
  assert.equal(verifyMoyasarWebhookSecret({}).ok, true);
  assert.equal(verifyMoyasarWebhookSecret({}).enforced, false);
  process.env.MOYASAR_WEBHOOK_SECRET = "tok_test";
  assert.equal(verifyMoyasarWebhookSecret({}).ok, false);
  assert.equal(verifyMoyasarWebhookSecret({ secret_token: "wrong" }).ok, false);
  assert.equal(verifyMoyasarWebhookSecret({ secret_token: "tok_test" }).ok, true);
  assert.equal(verifyMoyasarWebhookSecret({ secret_token: "tok_test" }).enforced, true);
  if (prev === undefined) delete process.env.MOYASAR_WEBHOOK_SECRET;
  else process.env.MOYASAR_WEBHOOK_SECRET = prev;
}

assertWebhookSecret()
  .then(() => console.log("test-admin-ops-musthaves: OK"))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

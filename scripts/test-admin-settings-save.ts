/**
 * إصلاح حفظ إعدادات اللوحة (Resend وغيرها).
 * npx tsx scripts/test-admin-settings-save.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(root, rel), "utf8");

const api = read("app/api/admin/settings/route.ts");
assert.ok(api.includes("ensureAppSettingsTable"));
assert.ok(api.includes("safeParse"));
assert.ok(api.includes("try {"));
assert.ok(api.includes("تعذّر الحفظ"));

const service = read("lib/modules/settings/settings-service.ts");
assert.ok(service.includes("ensureAppSettingsTable"));
assert.ok(service.includes("CREATE TABLE IF NOT EXISTS \"app_settings\""));
assert.ok(service.includes("await ensureAppSettingsTable()"));

const form = read("components/AdminSettingsForm.tsx");
assert.ok(form.includes("res.text()"));
assert.ok(form.includes("JSON.parse"));
assert.doesNotMatch(form, /const data = await res\.json\(\)/);

console.log("test-admin-settings-save: OK");

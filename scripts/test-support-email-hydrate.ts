/**
 * npx tsx scripts/test-support-email-hydrate.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(root, rel), "utf8");

const send = read("lib/modules/email/send.ts");
assert.ok(send.includes("hydrateEnvFromSettingsThrottled"));
assert.ok(send.includes("ensureEmailConfigured"));

const notify = read("lib/modules/support/notify.ts");
assert.ok(notify.includes("ensureEmailConfigured"));
assert.ok(notify.includes("messageId"));
assert.ok(notify.includes("دعم حكيم ·"));

const api = read("app/api/support/thread/route.ts");
assert.ok(api.includes("messageId: message.id"));

console.log("test-support-email-hydrate: OK");

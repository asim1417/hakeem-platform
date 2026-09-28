import assert from "node:assert/strict";
import {
  ensureAppSettingsTable,
  setSetting,
  getAllSettings,
} from "../lib/modules/settings/settings-service";

async function main() {
  await ensureAppSettingsTable();
  await setSetting("RESEND_API_KEY", "re_test_placeholder_not_real");
  await setSetting("RESEND_FROM", "حكيم <support@hakeemai.net>");
  const all = await getAllSettings();
  assert.equal(all.get("RESEND_API_KEY"), "re_test_placeholder_not_real");
  assert.equal(all.get("RESEND_FROM"), "حكيم <support@hakeemai.net>");
  await setSetting("RESEND_API_KEY", "");
  await setSetting("RESEND_FROM", "");
  console.log("test-settings-crypto-save: OK");
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});

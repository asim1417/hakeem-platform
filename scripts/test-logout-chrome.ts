/**
 * npx tsx scripts/test-logout-chrome.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.join(__dirname, "..");
const shell = fs.readFileSync(path.join(root, "components/AppShell.tsx"), "utf8");
const logout = fs.readFileSync(path.join(root, "components/LogoutButton.tsx"), "utf8");

assert.match(shell, /TopbarUserBar/);
assert.match(shell, /LogoutButton/);
assert.doesNotMatch(shell, /LogoutIconButton label=\{t\("topbar\.logout"\)\}/);
assert.match(logout, /SignOutButton/);
assert.match(logout, /owner-logout/);
assert.match(logout, /TopbarUserBar/);
assert.match(logout, /redirectUrl=\{AFTER_LOGOUT\}/);
assert.match(logout, /AFTER_LOGOUT = "\/"/);

console.log("test-logout-chrome: OK");

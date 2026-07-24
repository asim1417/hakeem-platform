/**
 * npx tsx scripts/test-logout-chrome.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.join(__dirname, "..");
const shell = fs.readFileSync(path.join(root, "components/AppShell.tsx"), "utf8");
const logout = fs.readFileSync(path.join(root, "components/LogoutButton.tsx"), "utf8");
const account = fs.readFileSync(path.join(root, "components/AccountMenu.tsx"), "utf8");

assert.match(shell, /AccountMenu/);
assert.match(shell, /LogoutButton/);
assert.doesNotMatch(shell, /LogoutIconButton/);
assert.doesNotMatch(shell, /TopbarUserBar/);

assert.match(logout, /SignOutButton/);
assert.match(logout, /owner-logout/);
assert.match(logout, /AFTER_LOGOUT = "\/"/);
assert.match(logout, /min-h-\[44px\]/);

assert.match(account, /SignOutButton/);
assert.match(account, /owner-logout/);
assert.match(account, /تسجيل الخروج/);
assert.match(account, /redirectUrl=\{AFTER_LOGOUT\}/);

console.log("test-logout-chrome: OK");

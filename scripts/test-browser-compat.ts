/**
 * توافق المتصفحات + next/font + طبقة browser-compat.
 * npx tsx scripts/test-browser-compat.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(root, rel), "utf8");

assert.ok(fs.existsSync(path.join(root, ".browserslistrc")));
assert.ok(fs.existsSync(path.join(root, "app/browser-compat.css")));

const browsers = read(".browserslistrc");
assert.ok(browsers.includes("Safari"));
assert.ok(browsers.includes("iOS"));

const layout = read("app/layout.tsx");
assert.ok(layout.includes("next/font/google"));
assert.ok(layout.includes("IBM_Plex_Sans_Arabic"));
assert.ok(layout.includes("Amiri"));
assert.ok(layout.includes("browser-compat.css"));
assert.ok(layout.includes("formatDetection"));
assert.ok(layout.includes("appleWebApp"));
assert.ok(layout.includes('viewportFit: "cover"'));
assert.equal(layout.includes("fonts.googleapis.com"), false, "external Google Fonts CSS removed");

const compat = read("app/browser-compat.css");
assert.ok(compat.includes("-webkit-backdrop-filter"));
assert.ok(compat.includes("100dvh"));
assert.ok(compat.includes("100svh"));
assert.ok(compat.includes("prefers-reduced-motion"));
assert.ok(compat.includes("touch-action: manipulation"));
assert.ok(compat.includes("box-sizing: border-box"));

const globals = read("app/globals.css");
assert.ok(globals.includes("-webkit-backdrop-filter"));

const watchdog = read("components/providers/BootWatchdog.tsx");
assert.ok(watchdog.includes("pageshow"));
assert.ok(watchdog.includes("persisted"));
assert.ok(watchdog.includes("visibilitychange"));

const nextCfg = read("next.config.mjs");
assert.ok(nextCfg.includes("poweredByHeader: false"));
assert.ok(nextCfg.includes("image/avif"));
assert.ok(nextCfg.includes("compress: true"));

const postcss = read("postcss.config.js");
assert.ok(postcss.includes("autoprefixer"));

console.log("test-browser-compat: OK");

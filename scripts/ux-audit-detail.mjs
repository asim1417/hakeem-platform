// متطلّب محليّ: npm i -D playwright@1.48.0
// جولة تفصيليّة: صفحات تفاصيل + قياسات أداء حقيقيّة + فحص تجاوب الجوّال (overflow/touch targets).
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = "http://localhost:3000";
const OUT = "ux-audit/screenshots";
const SHELL = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
const SYSTEM_ID = process.env.SYSTEM_ID;
const ARTICLE_ID = process.env.ARTICLE_ID;

const ROUTES = [
  { id: "system-detail", path: `/dashboard/legal-core/systems/${SYSTEM_ID}`, mobile: true },
  { id: "article-detail", path: `/dashboard/legal-core/articles/${ARTICLE_ID}`, mobile: true },
  { id: "legal-core-judgments", path: "/dashboard/legal-core/judgments" },
  { id: "legal-core-principles", path: "/dashboard/legal-core/principles" },
  { id: "legal-core-citations", path: "/dashboard/legal-core/citations" },
  { id: "legal-core-search", path: "/dashboard/legal-core/search", mobile: true },
  { id: "consultations", path: "/dashboard/consultations" },
  { id: "case-analysis", path: "/dashboard/case-analysis" },
  { id: "legal-chat", path: "/dashboard/legal-chat" },
  { id: "agents", path: "/dashboard/agents", mobile: true },
  { id: "attachments", path: "/dashboard/attachments" },
  { id: "admin-api-keys", path: "/admin/api-keys" },
  { id: "admin-inbox", path: "/admin/inbox" },
  { id: "admin-jobs", path: "/admin/jobs" },
  { id: "admin-settings", path: "/admin/settings", mobile: true },
  { id: "admin-site", path: "/admin/site" },
];

const report = [];
const browser = await chromium.launch({ executablePath: SHELL, headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "ar-SA" });
const lr = await ctx.request.post(BASE + "/api/auth/owner-login", { data: { email: "aasemalfarsi@gmail.com", password: "Qalam-1703!" } });
console.log("login:", lr.status());

async function cap(route, vp) {
  const pg = await ctx.newPage();
  await pg.setViewportSize({ width: vp.w, height: vp.h });
  const errs = [];
  pg.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 160)); });
  pg.on("pageerror", (e) => errs.push("PAGEERR: " + String(e).slice(0, 160)));
  let status = 0;
  try { const r = await pg.goto(BASE + route.path, { waitUntil: "networkidle", timeout: 45000 }); status = r?.status() ?? 0; }
  catch (e) { errs.push("NAV: " + String(e).slice(0, 120)); }
  await pg.waitForTimeout(600);
  try { await pg.screenshot({ path: `${OUT}/d-${route.id}-${vp.id}.png`, fullPage: true }); } catch {}

  // قياسات أداء + تجاوب حقيقيّة
  const metrics = await pg.evaluate((vw) => {
    const nav = performance.getEntriesByType("navigation")[0] || {};
    const paints = performance.getEntriesByType("paint");
    const fcp = paints.find((p) => p.name === "first-contentful-paint")?.startTime;
    let transfer = 0, res = 0;
    for (const r of performance.getEntriesByType("resource")) { transfer += r.transferSize || 0; res++; }
    // تجاوب: تجاوز أفقيّ؟
    const overflowX = document.documentElement.scrollWidth > vw + 2;
    const overflowBy = document.documentElement.scrollWidth - vw;
    // أهداف لمس صغيرة (<44px) بين الأزرار/الروابط المرئيّة
    const clickables = Array.from(document.querySelectorAll("button, a[href]")).filter((el) => {
      const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0;
    });
    const small = clickables.filter((el) => { const r = el.getBoundingClientRect(); return r.height < 40 || r.width < 24; }).length;
    return {
      domContentLoaded: Math.round(nav.domContentLoadedEventEnd || 0),
      loadComplete: Math.round(nav.loadEventEnd || 0),
      fcpMs: fcp ? Math.round(fcp) : null,
      resourceCount: res, transferKB: Math.round(transfer / 1024),
      overflowX, overflowBy, clickables: clickables.length, smallTargets: small,
    };
  }, vp.w).catch(() => null);

  report.push({ id: route.id, path: route.path, viewport: vp.id, status, consoleErrors: errs, metrics });
  process.stdout.write(`✓ ${route.id} @ ${vp.id} [${status}] err:${errs.length} ${metrics ? `dcl:${metrics.domContentLoaded}ms xfer:${metrics.transferKB}KB res:${metrics.resourceCount}${metrics.overflowX ? ` OVERFLOW+${metrics.overflowBy}` : ""}${metrics.smallTargets ? ` small:${metrics.smallTargets}` : ""}` : ""}\n`);
  await pg.close();
}

for (const r of ROUTES) {
  await cap(r, { id: "desktop", w: 1440, h: 900 });
  if (r.mobile) await cap(r, { id: "mobile", w: 390, h: 844 });
}
await browser.close();
fs.writeFileSync("ux-audit/_detail-report.json", JSON.stringify(report, null, 2));
console.log("\nحُفظ: ux-audit/_detail-report.json");

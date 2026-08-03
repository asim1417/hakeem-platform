// متطلّب محليّ: npm i -D playwright@1.48.0 (المتصفّح في /opt/pw-browsers)
// تدقيق المسارات المحميّة — يدخل كمالك (owner-login) ثم يلتقط لوحة/محادثة/إدارة حيًّا.
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = "http://localhost:3000";
const OUT = "ux-audit/screenshots";
const SHELL = "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";

// (id, path, {mobile?}) — mobile:true يلتقط الجوّال أيضًا
const ROUTES = [
  // عامّة متبقّية
  { id: "legal", path: "/legal", mobile: true },
  { id: "developers", path: "/developers" },
  { id: "api-docs", path: "/api-docs" },
  { id: "documents", path: "/documents" },
  { id: "notfound", path: "/this-route-does-not-exist-xyz", mobile: true },
  // لوحة العميل (محميّة)
  { id: "dashboard", path: "/dashboard?platform=1", mobile: true },
  { id: "ask", path: "/dashboard/ask", mobile: true },
  { id: "review", path: "/dashboard/review", mobile: true },
  { id: "review-empty", path: "/dashboard/review" },
  { id: "judicial-assistant", path: "/dashboard/judicial-assistant", mobile: true },
  { id: "simulations", path: "/dashboard/simulations" },
  { id: "legal-search", path: "/dashboard/legal-search", mobile: true },
  { id: "legal-core", path: "/dashboard/legal-core", mobile: true },
  { id: "legal-core-systems", path: "/dashboard/legal-core/systems" },
  { id: "knowledge-graph", path: "/dashboard/knowledge-graph" },
  { id: "files", path: "/dashboard/files", mobile: true },
  { id: "training", path: "/dashboard/training" },
  { id: "billing", path: "/dashboard/billing", mobile: true },
  { id: "onboarding", path: "/onboarding" },
  // الإدارة (محميّة، سوبر أدمن)
  { id: "admin", path: "/admin", mobile: true },
  { id: "admin-users", path: "/admin/users" },
  { id: "admin-usage", path: "/admin/usage" },
  { id: "admin-roles", path: "/admin/roles" },
  { id: "admin-ai", path: "/admin/ai" },
  { id: "admin-governance", path: "/admin/governance", mobile: true },
  { id: "admin-audit", path: "/admin/audit" },
  { id: "admin-services", path: "/admin/services" },
];

const report = [];
const browser = await chromium.launch({ executablePath: SHELL, headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "ar-SA" });

// دخول المالك — يضبط كوكي الجلسة في السياق
const loginResp = await ctx.request.post(BASE + "/api/auth/owner-login", {
  data: { email: "aasemalfarsi@gmail.com", password: "Qalam-1703!" },
});
console.log("login:", loginResp.status(), (await loginResp.json()).user?.role);

async function capture(route, vp) {
  const pg = await ctx.newPage();
  await pg.setViewportSize({ width: vp.w, height: vp.h });
  const errs = [];
  pg.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 180)); });
  pg.on("pageerror", (e) => errs.push("PAGEERR: " + String(e).slice(0, 180)));
  let status = 0;
  try {
    const r = await pg.goto(BASE + route.path, { waitUntil: "networkidle", timeout: 40000 });
    status = r?.status() ?? 0;
  } catch (e) { errs.push("NAV: " + String(e).slice(0, 140)); }
  await pg.waitForTimeout(700);
  const file = `${OUT}/p-${route.id}-${vp.id}.png`;
  try { await pg.screenshot({ path: file, fullPage: true }); } catch {}
  let dom = null;
  if (vp.id === "desktop") {
    dom = await pg.evaluate(() => {
      const q = (s) => Array.from(document.querySelectorAll(s));
      const inputs = q("input,select,textarea").filter((el) => el.type !== "hidden");
      const noLabel = inputs.filter((el) => {
        const id = el.getAttribute("id");
        return !(id && document.querySelector(`label[for="${id}"]`)) && !el.getAttribute("aria-label") && !el.getAttribute("aria-labelledby") && !el.closest("label");
      }).map((el) => el.getAttribute("name") || el.getAttribute("type") || el.tagName).slice(0, 10);
      const btnsNoName = q("button").filter((b) => !(b.textContent || "").trim() && !b.getAttribute("aria-label") && !b.querySelector("svg,img")).length;
      const iconBtnsNoAria = q("button").filter((b) => !(b.textContent || "").trim() && b.querySelector("svg") && !b.getAttribute("aria-label")).length;
      return {
        title: document.title, h1: q("h1").length,
        headings: q("h1,h2,h3").map((h) => h.tagName).join(","),
        links: q("a").length, emptyLinks: q("a").filter((a) => !(a.textContent || "").trim() && !a.getAttribute("aria-label") && !a.querySelector("img,svg")).length,
        noLabel, btnsNoName, iconBtnsNoAria,
        navItems: q("nav a").length,
        bodyLen: (document.body.innerText || "").length,
        bodyHead: (document.body.innerText || "").replace(/\s+/g, " ").slice(0, 160),
      };
    }).catch(() => null);
  }
  report.push({ id: route.id, path: route.path, viewport: vp.id, status, screenshot: file, consoleErrors: errs, dom });
  process.stdout.write(`✓ ${route.id} @ ${vp.id} [${status}] err:${errs.length}\n`);
  await pg.close();
}

for (const route of ROUTES) {
  await capture(route, { id: "desktop", w: 1440, h: 900 });
  if (route.mobile) await capture(route, { id: "mobile", w: 390, h: 844 });
}

await browser.close();
fs.writeFileSync("ux-audit/_protected-report.json", JSON.stringify(report, null, 2));
console.log("\nحُفظ: ux-audit/_protected-report.json");

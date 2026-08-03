// متطلّب تشغيل (محليّ فقط، خارج تبعيات التطبيق): npm i -D playwright@1.48.0  (المتصفّح مثبّت مسبقًا في /opt/pw-browsers)
// أداة التقاط أدلّة تدقيق UX — لقطات حقيقيّة + أخطاء console + فحوص DOM للوصول.
// تعمل ضدّ localhost فقط (الإنتاج محجوب بالوكيل). الصفحات المحميّة تُتخطّى (تحتاج DB+مصادقة).
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = "http://localhost:3000";
const OUT = "ux-audit/screenshots";

const PAGES = [
  { id: "home", path: "/" },
  { id: "login", path: "/login" },
  { id: "register", path: "/register" },
  { id: "pricing", path: "/pricing" },
  { id: "privacy", path: "/privacy" },
  { id: "terms", path: "/terms" },
];

const VIEWPORTS = [
  { id: "mobile", width: 390, height: 844 },
  { id: "tablet", width: 768, height: 1024 },
  { id: "desktop", width: 1440, height: 900 },
];

const report = [];

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell", headless: true });

for (const page of PAGES) {
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, locale: "ar-SA" });
    const pg = await ctx.newPage();
    const consoleErrors = [];
    pg.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200)); });
    pg.on("pageerror", (e) => consoleErrors.push("PAGEERROR: " + String(e).slice(0, 200)));
    let status = 0;
    try {
      const resp = await pg.goto(BASE + page.path, { waitUntil: "networkidle", timeout: 30000 });
      status = resp?.status() ?? 0;
    } catch (e) {
      consoleErrors.push("NAV_FAIL: " + String(e).slice(0, 160));
    }
    const file = `${OUT}/${page.id}-${vp.id}.png`;
    try { await pg.screenshot({ path: file, fullPage: true }); } catch { /* ignore */ }

    // فحوص DOM حقيقيّة (على سطح المكتب فقط لتفادي التكرار)
    let dom = null;
    if (vp.id === "desktop") {
      dom = await pg.evaluate(() => {
        const q = (s) => Array.from(document.querySelectorAll(s));
        const htmlEl = document.documentElement;
        const imgsNoAlt = q("img").filter((i) => !i.hasAttribute("alt")).length;
        const inputs = q("input,select,textarea");
        const inputsNoLabel = inputs.filter((el) => {
          const id = el.getAttribute("id");
          const hasFor = id && document.querySelector(`label[for="${id}"]`);
          const aria = el.getAttribute("aria-label") || el.getAttribute("aria-labelledby");
          const wrapLabel = el.closest("label");
          const ph = el.getAttribute("placeholder");
          return !hasFor && !aria && !wrapLabel && (el.type !== "hidden");
        }).map((el) => el.getAttribute("name") || el.getAttribute("type") || el.tagName).slice(0, 12);
        const btnsNoName = q("button").filter((b) => !(b.textContent || "").trim() && !b.getAttribute("aria-label")).length;
        const h1 = q("h1").length;
        const headings = q("h1,h2,h3,h4,h5,h6").map((h) => h.tagName).join(",");
        const links = q("a").length;
        const emptyLinks = q("a").filter((a) => !(a.textContent || "").trim() && !a.getAttribute("aria-label") && !a.querySelector("img,svg")).length;
        const viewport = document.querySelector('meta[name="viewport"]')?.getAttribute("content") || null;
        const title = document.title;
        const langDir = { lang: htmlEl.getAttribute("lang"), dir: htmlEl.getAttribute("dir") };
        const bodyText = (document.body.innerText || "").replace(/\s+/g, " ").slice(0, 400);
        return { langDir, title, viewport, h1, headings, links, emptyLinks, imgsNoAlt, inputsNoLabel, btnsNoName, bodyText };
      }).catch(() => null);
    }

    report.push({ page: page.id, path: page.path, viewport: vp.id, status, screenshot: file, consoleErrors, dom });
    await ctx.close();
    process.stdout.write(`✓ ${page.id} @ ${vp.id} [${status}] err:${consoleErrors.length}\n`);
  }
}

await browser.close();
fs.writeFileSync("ux-audit/_capture-report.json", JSON.stringify(report, null, 2));
console.log("\nحُفظ التقرير: ux-audit/_capture-report.json");

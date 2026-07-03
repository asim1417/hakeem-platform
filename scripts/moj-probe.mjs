/**
 * moj-probe.mjs — استكشاف واجهة API لبوابة العدل (laws.moj.gov.sa / laws-gateway.moj.gov.sa)
 * عبر متصفّح حقيقي، لاكتشاف: (أ) نقطة قائمة الأنظمة، (ب) نقطة مواد/أقسام النظام (لعدّها رسميًا).
 * يلتقط كل نداءات API (الطريقة، الرابط، جسم POST، بنية الاستجابة). قراءة فقط — لا قاعدة بيانات.
 */
const { chromium } = await import("playwright");
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const ctx = await browser.newContext({
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
  locale: "ar-SA",
});
const page = await ctx.newPage();

const API = /(laws-gateway\.moj\.gov\.sa|\/apis\/|\/api\/)/;
const reqBody = new Map(); // url -> postData
page.on("request", (r) => {
  if (API.test(r.url())) {
    const pd = r.postData();
    if (pd) reqBody.set(r.url(), pd);
  }
});

const seen = [];
page.on("response", async (res) => {
  const url = res.url();
  if (!API.test(url)) return;
  let summary = "";
  try {
    const ct = (res.headers()["content-type"] || "").toLowerCase();
    if (/json/.test(ct)) {
      const j = await res.json();
      const describe = (o) => {
        if (Array.isArray(o)) return `Array(${o.length})` + (o.length ? " من " + describe(o[0]) : "");
        if (o && typeof o === "object") return "{ " + Object.keys(o).slice(0, 16).join(", ") + " }";
        return typeof o;
      };
      summary = describe(j);
      const arrays = [];
      const walk = (o, path) => {
        if (Array.isArray(o)) {
          if (o.length) arrays.push(`${path}: Array(${o.length})`);
        } else if (o && typeof o === "object") Object.entries(o).forEach(([k, v]) => walk(v, path ? `${path}.${k}` : k));
      };
      walk(j, "");
      if (arrays.length) summary += " | مصفوفات: " + arrays.slice(0, 8).join(" · ");
    } else summary = ct;
  } catch {
    summary = "(تعذّر قراءة الجسم)";
  }
  seen.push({ method: res.request().method(), status: res.status(), url, body: reqBody.get(url) || "", summary });
});

async function dump(tag) {
  console.log(`\n${"=".repeat(92)}\n${tag}\n${"=".repeat(92)}`);
  const uniq = [...new Map(seen.map((s) => [s.method + s.url, s])).values()];
  if (!uniq.length) console.log("  (لا نداءات API)");
  for (const s of uniq) {
    console.log(`\n• ${s.method} ${s.status} ${s.url}`);
    if (s.body) console.log(`   POST body: ${s.body.slice(0, 400)}`);
    console.log(`   استجابة: ${s.summary.slice(0, 500)}`);
  }
  seen.length = 0;
}

try {
  await page.goto("https://laws.moj.gov.sa/ar", { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(5000);
  console.log("الرابط:", page.url());
  await dump("① نداءات API عند تحميل الصفحة الرئيسة");

  // روابط مرشّحة لصفحات الأنظمة/التشريعات
  const links = await page.$$eval("a[href]", (as) =>
    as
      .map((a) => a.getAttribute("href"))
      .filter((h) => h && /legislation|statute|systems|law|تشريع|نظام/i.test(h))
  );
  const uniqLinks = [...new Set(links)];
  console.log("\nروابط مرشّحة:", JSON.stringify(uniqLinks.slice(0, 20), null, 0));

  // انتقل إلى أول رابط تشريع/نظام حقيقي (لالتقاط نداء تفاصيل النظام + الأقسام/المواد)
  const target = uniqLinks.find((h) => /\/(legislation|law|statute)s?\/[^/]+/i.test(h)) || uniqLinks[0];
  if (target) {
    const abs = target.startsWith("http") ? target : new URL(target, "https://laws.moj.gov.sa").href;
    console.log("\n→ الانتقال إلى:", abs);
    await page.goto(abs, { waitUntil: "domcontentloaded", timeout: 45000 }).catch((e) => console.log("تعذّر:", e?.message?.slice(0, 120)));
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(5000);
    await dump("② نداءات API عند فتح صفحة نظام/تشريع");
  }

  // جرّب البحث في الصفحة الرئيسة
  await page.goto("https://laws.moj.gov.sa/ar", { waitUntil: "domcontentloaded", timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(2500);
  const box = await page.$('input[type="search"], input[placeholder*="بحث"], input[type="text"]');
  if (box) {
    await box.fill("الأحوال الشخصية");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(5000);
    await dump("③ نداءات API بعد بحث «الأحوال الشخصية»");
  } else {
    console.log("لم يُعثر على حقل بحث في الصفحة الرئيسة.");
  }

  // فحص مباشر لأنماط نقاط معروفة/محتملة على البوابة (GET) — لكشف العقد بلا تخمين
  const CANDIDATES = [
    "https://laws-gateway.moj.gov.sa/apis/legislations/v1/statute",
    "https://laws-gateway.moj.gov.sa/apis/legislations/v1/statutes",
    "https://laws-gateway.moj.gov.sa/apis/legislations/v1/statute/list",
    "https://laws-gateway.moj.gov.sa/apis/legislations/v1/categories",
  ];
  console.log(`\n${"=".repeat(92)}\n④ فحص مباشر لنقاط مرشّحة (GET من داخل الصفحة)\n${"=".repeat(92)}`);
  for (const u of CANDIDATES) {
    const r = await page
      .evaluate(async (url) => {
        try {
          const res = await fetch(url, { headers: { accept: "application/json" } });
          const ct = res.headers.get("content-type") || "";
          let shape = "";
          if (/json/.test(ct)) {
            const j = await res.json();
            shape = Array.isArray(j) ? `Array(${j.length})` : "{ " + Object.keys(j || {}).slice(0, 12).join(", ") + " }";
          } else shape = ct;
          return { status: res.status, shape };
        } catch (e) {
          return { status: "ERR", shape: String(e).slice(0, 120) };
        }
      }, u)
      .catch((e) => ({ status: "ERR", shape: String(e).slice(0, 120) }));
    console.log(`• GET ${r.status}  ${u}\n   → ${r.shape}`);
  }
} catch (e) {
  console.log("تعذّر:", e?.message?.slice(0, 200) || e);
} finally {
  await dump("⑤ ما تبقّى من نداءات");
  await browser.close();
}

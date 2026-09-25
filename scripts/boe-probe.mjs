/**
 * boe-probe.mjs — استكشاف مصدر رسمي للائحة التنفيذية لنظام الشركات (صادرة عن وزارة التجارة).
 * البوابة القانونية للعدل لا تستضيفها؛ فنستكشف المصدر الحكومي الرسمي:
 *   ① هيئة الخبراء بمجلس الوزراء — laws.boe.gov.sa (المرجع الرسمي لكل الأنظمة السعودية)
 *   ② وزارة التجارة — mc.gov.sa (الجهة المُصدِرة)
 * نلتقط كل نداءات API (طريقة/رابط/بنية) على: الرئيسة، بحث «لائحة الشركات»، صفحة تشريع.
 * الهدف: كشف نقطة البحث ونقطة تفاصيل المواد لنعدّها ونسحبها لاحقًا رسميًّا. قراءة فقط — لا قاعدة بيانات.
 */
const { chromium } = await import("playwright");
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const ctx = await browser.newContext({
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
  locale: "ar-SA",
});
const page = await ctx.newPage();

const API = /(boe\.gov\.sa|mc\.gov\.sa|\/api\/|\/apis\/|wp-json|graphql|\.json)/i;
const reqBody = new Map();
page.on("request", (r) => { if (API.test(r.url())) { const pd = r.postData(); if (pd) reqBody.set(r.url(), pd); } });

const seen = [];
page.on("response", async (res) => {
  const url = res.url();
  if (!API.test(url)) return;
  let summary = "";
  try {
    const ct = (res.headers()["content-type"] || "").toLowerCase();
    if (/json/.test(ct)) {
      const j = await res.json();
      const describe = (o) => Array.isArray(o) ? `Array(${o.length})` + (o.length ? " of " + describe(o[0]) : "") : (o && typeof o === "object" ? "{ " + Object.keys(o).slice(0, 18).join(", ") + " }" : typeof o);
      summary = describe(j);
      const arrays = [];
      const walk = (o, path) => { if (Array.isArray(o)) { if (o.length) arrays.push(`${path}: Array(${o.length})`); } else if (o && typeof o === "object") Object.entries(o).forEach(([k, v]) => walk(v, path ? `${path}.${k}` : k)); };
      walk(j, "");
      if (arrays.length) summary += " | arrays: " + arrays.slice(0, 10).join(" · ");
    } else summary = ct;
  } catch { summary = "(unreadable body)"; }
  seen.push({ method: res.request().method(), status: res.status(), url, body: reqBody.get(url) || "", summary });
});

async function dump(tag) {
  console.log(`\n${"=".repeat(96)}\n${tag}\n${"=".repeat(96)}`);
  const uniq = [...new Map(seen.map((s) => [s.method + s.url, s])).values()];
  if (!uniq.length) console.log("  (no API calls)");
  for (const s of uniq) {
    console.log(`\n• ${s.method} ${s.status} ${s.url.slice(0, 160)}`);
    if (s.body) console.log(`   POST body: ${s.body.slice(0, 300)}`);
    console.log(`   response: ${s.summary.slice(0, 460)}`);
  }
  seen.length = 0;
}

async function visit(url, tag, { search } = {}) {
  try {
    console.log(`\n→ ${tag}: ${url}`);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(4000);
    console.log("   final url:", page.url(), "· title:", (await page.title()).slice(0, 80));
    if (search) {
      const box = await page.$('input[type="search"], input[placeholder*="بحث"], input[type="text"], input[name*="search" i]');
      if (box) { await box.fill(search); await page.keyboard.press("Enter"); await page.waitForTimeout(5000); console.log("   (searched:", search, ")"); }
      else console.log("   (no search box found)");
    }
    await dump(tag);
  } catch (e) { console.log("   ✗", (e?.message || e).toString().slice(0, 160)); await dump(tag + " [partial]"); }
}

try {
  // ① هيئة الخبراء — laws.boe.gov.sa
  await visit("https://laws.boe.gov.sa/", "① BOE home");
  await visit("https://laws.boe.gov.sa/BoeLaws/Laws/Search?query=%D8%A7%D9%84%D9%84%D8%A7%D8%A6%D8%AD%D8%A9%20%D8%A7%D9%84%D8%AA%D9%86%D9%81%D9%8A%D8%B0%D9%8A%D8%A9%20%D9%84%D9%86%D8%B8%D8%A7%D9%85%20%D8%A7%D9%84%D8%B4%D8%B1%D9%83%D8%A7%D8%AA", "② BOE search-url (lائحة الشركات)", { search: "اللائحة التنفيذية لنظام الشركات" });

  // ② probe candidate BOE API endpoints directly (GET) — كشف بلا تخمين
  const CANDIDATES = [
    "https://laws.boe.gov.sa/api/laws/search?query=%D8%A7%D9%84%D8%B4%D8%B1%D9%83%D8%A7%D8%AA",
    "https://laws.boe.gov.sa/BoeLaws/Laws/Search/%D8%A7%D9%84%D8%B4%D8%B1%D9%83%D8%A7%D8%AA",
  ];
  console.log(`\n${"=".repeat(96)}\n③ direct GET probes (BOE)\n${"=".repeat(96)}`);
  for (const u of CANDIDATES) {
    const r = await page.evaluate(async (url) => { try { const res = await fetch(url, { headers: { accept: "application/json" } }); const ct = res.headers.get("content-type") || ""; return { status: res.status, ct, len: (await res.text()).length }; } catch (e) { return { status: "ERR", ct: String(e).slice(0, 100), len: 0 }; } }, u).catch((e) => ({ status: "ERR", ct: String(e).slice(0, 100), len: 0 }));
    console.log(`• GET ${r.status} [${r.ct.slice(0, 40)}] len=${r.len}  ${u.slice(0, 120)}`);
  }

  // ③ وزارة التجارة — mc.gov.sa
  await visit("https://mc.gov.sa/ar/Regulations/Pages/default.aspx", "④ MC regulations page", { search: "اللائحة التنفيذية لنظام الشركات" });
} catch (e) {
  console.log("تعذّر:", (e?.stack || e).toString().slice(0, 400));
} finally {
  await dump("⑤ remaining");
  await browser.close();
}

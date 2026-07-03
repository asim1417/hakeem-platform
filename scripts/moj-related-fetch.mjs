/**
 * moj-related-fetch.mjs — يجمع من بوابة العدل كل الأدوات المرتبطة بكل نظام أساسي
 * (relatedLegal + otherRelatedLegal: لوائح/أدلة/ضوابط/قواعد…) ويطبع JSON على stdout.
 * السجلّات التشخيصية على stderr. قراءة من المصدر فقط — لا قاعدة بيانات. (يُشغَّل عبر node)
 */
const { chromium } = await import("playwright");
const BASE = "https://laws-gateway.moj.gov.sa/apis/legislations/v1";

const CORE = [
  { name: "نظام المعاملات المدنية", serial: "PBbHmywh1XMp-Kyv3NtQLg" },
  { name: "نظام المرافعات الشرعية", serial: "sSe-gyvwrajdndY5P08WZg" },
  { name: "نظام الإثبات", serial: "UbB0wpvasVhoTAgmYKUA7A" },
  { name: "نظام الأحوال الشخصية", serial: "xt6PShke0baUTC0OdfS9AQ" },
  { name: "نظام الإجراءات الجزائية", serial: "BdFRJFma6kPhQqhIh2f7eQ" },
  { name: "نظام المحاكم التجارية", serial: "5-3nY9odCRxj7FPBTXJG0Q" },
  { name: "نظام الإفلاس", serial: "-FF20eK5iu1hvvKJe5GZVQ" },
  { name: "نظام التوثيق", serial: "g28zaD-gXzN_8DAm9qbydw" },
  { name: "نظام التحكيم", serial: "b_jI6RVZmizpiPSUSqLs7g" },
];

const norm = (s) => (s || "").replace(/[ً-ْٰـ]/g, "").replace(/[إأآ]/g, "ا").replace(/ئ/g, "ي").replace(/ؤ/g, "و").replace(/ء/g, "").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/\s+/g, " ").trim();

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const ctx = await browser.newContext({ userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36", locale: "ar-SA" });
const page = await ctx.newPage();
const apiGet = (path) => page.evaluate(async (url) => { const r = await fetch(url, { headers: { accept: "application/json" } }); return { status: r.status, json: await r.json().catch(() => null) }; }, `${BASE}${path}`);

const out = [];
let dumped = false;
try {
  await page.goto("https://laws.moj.gov.sa/ar", { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(3000);

  for (const c of CORE) {
    const d = await apiGet(`/statute/get-Statute-gateway-Detail?Serial=${encodeURIComponent(c.serial)}&identityNumber=`);
    const m = d.json?.model ?? {};
    const items = [];
    if (m.relatedLegalName) items.push({ name: String(m.relatedLegalName).trim(), serial: m.relatedLegalSerial ?? null, typeName: m.relatedLegalTypeName ?? null, via: "relatedLegal" });
    const other = m.otherRelatedLegal;
    if (!dumped && Array.isArray(other) && other.length) { console.error("otherRelatedLegal keys:", Object.keys(other[0]).join(", ")); dumped = true; }
    if (Array.isArray(other)) {
      for (const o of other) {
        const name = (o?.name ?? o?.statuteName ?? o?.title ?? o?.relatedLegalName ?? "").toString().trim();
        if (name) items.push({ name, serial: o?.serial ?? o?.relatedLegalSerial ?? o?.id ?? null, typeName: o?.legalTypeName ?? o?.typeName ?? o?.relatedLegalTypeName ?? null, via: "otherRelatedLegal" });
      }
    }
    const uniq = new Map();
    for (const it of items) if (!uniq.has(norm(it.name))) uniq.set(norm(it.name), it);
    const list = [...uniq.values()];
    console.error(`▮ ${c.name} — ${list.length} مرتبط`);
    for (const it of list) console.error(`    · «${it.name}»${it.typeName ? ` [${it.typeName}]` : ""} via=${it.via}`);
    out.push({ system: c.name, serial: c.serial, items: list });
  }
} catch (e) {
  console.error("تعذّر:", e?.stack?.slice(0, 400) || e);
  process.exitCode = 1;
} finally {
  await browser.close();
}
process.stdout.write(JSON.stringify(out));

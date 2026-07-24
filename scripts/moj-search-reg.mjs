/**
 * moj-search-reg.mjs — يبحث في بوابة العدل القانونية عن تشريع باسمٍ مُعطى (وسيط سطر الأوامر)،
 * ويطبع لكل نتيجة: الاسم، الـSerial، الجهة، التصنيف، تاريخ الإصدار، وعدد المواد الرسمي
 * (بعدّ statuteStructure النوع 1). الغرض: كشف هل تستضيف البوابة لائحةً معيّنة (مثل لائحة الشركات)
 * حتى لو كان نظامها الأمّ صادرًا عن جهة أخرى (التجارة/الموارد). قراءة فقط — لا قاعدة بيانات.
 *
 * الاستعمال: node scripts/moj-search-reg.mjs "اللائحة التنفيذية لنظام الشركات"
 */
const KEYWORD = process.argv[2] || "اللائحة التنفيذية لنظام الشركات";

const { chromium } = await import("playwright");
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const ctx = await browser.newContext({
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
  locale: "ar-SA",
});
const page = await ctx.newPage();
const BASE = "https://laws-gateway.moj.gov.sa/apis/legislations/v1";

const apiPost = (path, body) =>
  page.evaluate(
    async ({ url, body }) => {
      const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json", accept: "application/json" }, body: JSON.stringify(body) });
      return { status: r.status, json: await r.json().catch(() => null) };
    },
    { url: `${BASE}${path}`, body }
  );
const apiGet = (path) =>
  page.evaluate(
    async (url) => {
      const r = await fetch(url, { headers: { accept: "application/json" } });
      return { status: r.status, json: await r.json().catch(() => null) };
    },
    `${BASE}${path}`
  );

const searchBody = (keyword) => ({
  pageNumber: 1, pageSize: 30, detailsKeyword: "", LegalStatue: null, classificationId: null, sortingBy: 7,
  statuteIssueDateFrom: null, statuteIssueDateTo: null, statuteName: "", statutePublishDateFrom: null,
  statutePublishDateTo: null, statuteType: null, keyword, isSearch: true, identityNumber: "",
});

function countArticles(nodes) {
  let total = 0, labeled = 0;
  const walk = (arr) => { if (!Array.isArray(arr)) return; for (const n of arr) { if (n && n.type === 1) { total++; if (typeof n.sequence === "string" && n.sequence.includes("المادة")) labeled++; } if (n && Array.isArray(n.items)) walk(n.items); } };
  walk(nodes);
  return { total, labeled };
}

try {
  await page.goto("https://laws.moj.gov.sa/ar", { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(3000);

  console.log("═".repeat(92));
  console.log(`بحث بوابة العدل عن: «${KEYWORD}»`);
  console.log("═".repeat(92));

  const res = await apiPost("/statute/section-search", searchBody(KEYWORD));
  const coll = res.json?.model?.collection || [];
  console.log(`نتائج: ${coll.length}`);
  if (!coll.length) {
    console.log("❌ لا نتائج — البوابة لا تستضيف هذا التشريع باسمه المُعطى.");
  }

  for (const it of coll) {
    console.log("\n" + "─".repeat(92));
    console.log(`• «${it.statuteName}» · serial=${it.serial}`);
    const d = await apiGet(`/statute/get-Statute-gateway-Detail?Serial=${encodeURIComponent(it.serial)}&identityNumber=`);
    const m = d.json?.model || {};
    const { total, labeled } = countArticles(m.statuteStructure);
    console.log(`   الجهة=${m.concernedAuthorityName ?? "∅"} · التصنيف=${m.classificationName ?? "∅"} · النوع=${m.legalTypeName ?? "∅"}`);
    console.log(`   الإصدار هـ=${m.issuanceDate ?? "∅"} · م=${(m.issuanceDateGerogian || "").slice(0, 10) || "∅"}`);
    console.log(`   مواد رسمية (statuteStructure نوع 1)=${total} (بعنوان «المادة»=${labeled})`);
    console.log(`   لائحة/نظام مرتبط=${m.relatedLegalName ? `«${m.relatedLegalName}» serial=${m.relatedLegalSerial}` : "∅"}`);
    console.log(`   رابط: https://laws.moj.gov.sa/ar/legislation/${it.serial}`);
  }
} catch (e) {
  console.log("تعذّر:", e?.stack?.slice(0, 500) || e);
  process.exit(1);
} finally {
  await browser.close();
}

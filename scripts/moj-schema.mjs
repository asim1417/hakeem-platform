/**
 * moj-schema.mjs — يكشف مخطّط استجابات بوابة العدل بالتفصيل (قراءة فقط، لا قاعدة بيانات):
 *  (1) POST /statute/section-search بكلمة «المعاملات المدنية» → طباعة أول عنصر كاملًا (لمعرفة Serial واسم النظام وأي عدّ).
 *  (2) GET /statute/get-Statute-gateway-Detail?Serial=… → طباعة statuteStructure كاملًا (لفهم كيفية عدّ المواد).
 * كل النداءات تُجرى من داخل صفحة laws.moj.gov.sa (نفس الأصل) عبر fetch.
 */
const { chromium } = await import("playwright");
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const ctx = await browser.newContext({
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
  locale: "ar-SA",
});
const page = await ctx.newPage();

const BASE = "https://laws-gateway.moj.gov.sa/apis/legislations/v1";

async function apiPost(path, body) {
  return page.evaluate(
    async ({ url, body }) => {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(body),
      });
      return { status: res.status, json: await res.json().catch(() => null) };
    },
    { url: `${BASE}${path}`, body }
  );
}
async function apiGet(path) {
  return page.evaluate(
    async (url) => {
      const res = await fetch(url, { headers: { accept: "application/json" } });
      return { status: res.status, json: await res.json().catch(() => null) };
    },
    `${BASE}${path}`
  );
}

// اختصر السلاسل الطويلة/التضمين العميق لإبقاء المخرجات مقروءة
function trim(o, depth = 0) {
  if (typeof o === "string") return o.length > 160 ? o.slice(0, 160) + "…" : o;
  if (Array.isArray(o)) return depth >= 4 ? `Array(${o.length})` : o.slice(0, 6).map((x) => trim(x, depth + 1));
  if (o && typeof o === "object") {
    const out = {};
    for (const [k, v] of Object.entries(o)) out[k] = trim(v, depth + 1);
    return out;
  }
  return o;
}

try {
  await page.goto("https://laws.moj.gov.sa/ar", { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(3500);

  const searchBody = {
    pageNumber: 1,
    pageSize: 9,
    detailsKeyword: "",
    LegalStatue: null,
    classificationId: null,
    sortingBy: 7,
    statuteIssueDateFrom: null,
    statuteIssueDateTo: null,
    statuteName: "",
    statutePublishDateFrom: null,
    statutePublishDateTo: null,
    statuteType: null,
    keyword: "المعاملات المدنية",
    isSearch: true,
    identityNumber: "",
  };
  const search = await apiPost("/statute/section-search", searchBody);
  console.log("═".repeat(92));
  console.log("① section-search «المعاملات المدنية» — status:", search.status);
  console.log("═".repeat(92));
  const coll = search.json?.model?.collection || [];
  console.log("عدد النتائج:", coll.length);
  console.log("\n— أول عنصر كامل (مقصوص):\n", JSON.stringify(trim(coll[0]), null, 2));
  console.log("\n— مفاتيح كل النتائج + الاسم:");
  for (const it of coll) {
    const keys = Object.keys(it);
    const name = it.name || it.statuteName || it.title || it.arabicName || "?";
    const serial = it.serial || it.Serial || it.id || it.serialNumber || "?";
    console.log(`   • serial=${serial} · name=«${name}» · keys=[${keys.join(",")}]`);
  }
  console.log("\n— فلاتر النتائج (model.filters):\n", JSON.stringify(trim(search.json?.model?.filters), null, 2));

  // خذ Serial لأول نتيجة وجلب التفاصيل
  const first = coll[0] || {};
  const serial = first.serial || first.Serial || first.id || first.serialNumber;
  if (serial) {
    const detail = await apiGet(`/statute/get-Statute-gateway-Detail?Serial=${encodeURIComponent(serial)}&identityNumber=`);
    console.log("\n" + "═".repeat(92));
    console.log(`② get-Statute-gateway-Detail Serial=${serial} — status:`, detail.status);
    console.log("═".repeat(92));
    const m = detail.json?.model || {};
    console.log("مفاتيح model:", Object.keys(m).join(", "));
    console.log("\n— statuteStructure (مقصوص، عمق 5):\n", JSON.stringify(trim(m.statuteStructure), null, 2));
    // عدّ محتمل: أوراق تحمل رقم مادة
    const flat = [];
    const walk = (nodes) => {
      if (!Array.isArray(nodes)) return;
      for (const n of nodes) {
        flat.push(Object.keys(n));
        for (const v of Object.values(n)) if (Array.isArray(v)) walk(v);
      }
    };
    walk(m.statuteStructure);
    console.log("\n— أنواع العُقد (مفاتيح مميّزة):", JSON.stringify([...new Set(flat.map((k) => k.join(",")))].slice(0, 12), null, 0));
  } else {
    console.log("لم أستخرج Serial من أول نتيجة.");
  }
} catch (e) {
  console.log("تعذّر:", e?.stack?.slice(0, 400) || e);
} finally {
  await browser.close();
}

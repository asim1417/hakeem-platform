/**
 * moj-counts.mjs — يجلب من البوابة القانونية (المصدر الرسمي) لكل نظام أساسي، عبر Serial مباشر
 * حيث عُرِف (تفاديًا لضعف بحث الكلمة المفتاحية)، وإلا بحثًا واسعًا:
 *   • البيانات الرسمية: الاسم، الجهة، التصنيف، تاريخ الإصدار، عدد المواد (بعدّ statuteStructure النوع 1).
 *   • اللائحة التنفيذية: بحث «اللائحة التنفيذية لنظام …» ومطابقة اسم دقيقة.
 * قراءة فقط — لا قاعدة بيانات. يُشغَّل عبر moj-probe.yml (script=moj-counts.mjs).
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

const norm = (s) => (s || "").replace(/[ً-ْٰـ]/g, "").replace(/[إأآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/\s+/g, " ").trim();

function countArticles(nodes) {
  let total = 0, labeled = 0;
  const walk = (arr) => { if (!Array.isArray(arr)) return; for (const n of arr) { if (n && n.type === 1) { total++; if (typeof n.sequence === "string" && n.sequence.includes("المادة")) labeled++; } if (n && Array.isArray(n.items)) walk(n.items); } };
  walk(nodes);
  return { total, labeled };
}

async function detail(serial) {
  const d = await apiGet(`/statute/get-Statute-gateway-Detail?Serial=${encodeURIComponent(serial)}&identityNumber=`);
  const m = d.json?.model || {};
  return {
    status: d.status,
    name: m.name, classification: m.classificationName, authority: m.concernedAuthorityName,
    legalType: m.legalTypeName, issuanceDate: m.issuanceDate, issuanceG: m.issuanceDateGerogian,
    validFrom: m.validFromDate, relatedName: m.relatedLegalName, relatedSerial: m.relatedLegalSerial,
    boeUrl: m.bureauOfExpertsAtTheCouncilOfMinistersUrl, ...countArticles(m.statuteStructure),
  };
}

// Serials مؤكَّدة من التشغيل السابق (٩ من ١١)
const KNOWN = {
  "نظام المعاملات المدنية": "PBbHmywh1XMp-Kyv3NtQLg",
  "نظام المرافعات الشرعية": "sSe-gyvwrajdndY5P08WZg",
  "نظام الإثبات": "UbB0wpvasVhoTAgmYKUA7A",
  "نظام الأحوال الشخصية": "xt6PShke0baUTC0OdfS9AQ",
  "نظام الإجراءات الجزائية": "BdFRJFma6kPhQqhIh2f7eQ",
  "نظام المحاكم التجارية": "5-3nY9odCRxj7FPBTXJG0Q",
  "نظام الإفلاس": "-FF20eK5iu1hvvKJe5GZVQ",
  "نظام التوثيق": "g28zaD-gXzN_8DAm9qbydw",
  "نظام التحكيم": "b_jI6RVZmizpiPSUSqLs7g",
};
const SYSTEMS = [
  "نظام المعاملات المدنية", "نظام المرافعات الشرعية", "نظام الإثبات", "نظام الأحوال الشخصية",
  "نظام الإجراءات الجزائية", "نظام الشركات", "نظام المحاكم التجارية", "نظام العمل",
  "نظام الإفلاس", "نظام التوثيق", "نظام التحكيم",
];

const OUT = [];
try {
  await page.goto("https://laws.moj.gov.sa/ar", { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(3000);

  for (const sys of SYSTEMS) {
    console.log("\n" + "─".repeat(92) + "\n▮ " + sys);
    let serial = KNOWN[sys];
    let searchNames = [];
    if (!serial) {
      // بحث واسع + مطابقة اسم دقيقة (مطبَّعة)
      const res = await apiPost("/statute/section-search", searchBody(sys));
      const coll = res.json?.model?.collection || [];
      searchNames = coll.map((it) => it.statuteName);
      console.log(`  بحث «${sys}» → ${coll.length} نتيجة: ${searchNames.map((n) => `«${n}»`).join(" · ") || "—"}`);
      const exact = coll.find((it) => norm(it.statuteName) === norm(sys)) || coll.find((it) => norm(it.statuteName).includes(norm(sys)));
      serial = exact?.serial;
    }

    if (!serial) {
      console.log(`  ❌ غير موجود على بوابة العدل (يُرجّح أن مصدره جهة أخرى: التجارة/الموارد البشرية).`);
      OUT.push({ system: sys, onPortal: false, searchNames });
      continue;
    }

    const d = await detail(serial);
    console.log(`  ★ «${d.name}» — مواد رسمية=${d.total} (بعنوان «المادة»=${d.labeled})`);
    console.log(`     الجهة=${d.authority ?? "∅"} · التصنيف=${d.classification ?? "∅"} · النوع=${d.legalType ?? "∅"}`);
    console.log(`     الإصدار هـ=${d.issuanceDate ?? "∅"} · م=${(d.issuanceG || "").slice(0, 10) || "∅"} · نفاذ=${(d.validFrom || "").slice(0, 10) || "∅"}`);
    console.log(`     لائحة مرتبطة (relatedLegal)=${d.relatedName ? `«${d.relatedName}» serial=${d.relatedSerial}` : "∅"} · هيئة الخبراء=${d.boeUrl ? "نعم" : "∅"}`);

    // اللائحة التنفيذية عبر بحث اسمها الصريح
    const regName = sys.replace(/^نظام\s+/, "اللائحة التنفيذية لنظام ");
    const rres = await apiPost("/statute/section-search", searchBody(regName));
    const rcoll = rres.json?.model?.collection || [];
    const reg = rcoll.find((it) => norm(it.statuteName) === norm(regName)) || rcoll.find((it) => norm(it.statuteName).includes(norm(regName)));
    let regRec = null;
    if (reg?.serial) { const rd = await detail(reg.serial); regRec = { name: rd.name, serial: reg.serial, articles: rd.total }; console.log(`     ⚖ لائحته: «${rd.name}» — مواد=${rd.total}`); }
    else console.log(`     ⚖ لائحته: ✗ لم تُطابَق «${regName}»`);
    // أيضًا relatedLegal كلائحة محتملة
    OUT.push({ system: sys, onPortal: true, serial, name: d.name, authority: d.authority, classification: d.classification, legalType: d.legalType, issuanceDate: d.issuanceDate, issuanceG: (d.issuanceG || "").slice(0, 10), officialArticles: d.total, labeled: d.labeled, related: d.relatedName ? { name: d.relatedName, serial: d.relatedSerial } : null, regulation: regRec });
  }

  console.log("\n" + "═".repeat(92) + "\nJSON_RESULT_BEGIN");
  console.log(JSON.stringify(OUT, null, 0));
  console.log("JSON_RESULT_END");
} catch (e) {
  console.log("تعذّر:", e?.stack?.slice(0, 500) || e);
} finally {
  await browser.close();
}

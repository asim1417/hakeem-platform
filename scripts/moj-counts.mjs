/**
 * moj-counts.mjs — يجلب من بوابة العدل القانونية (المصدر الرسمي) لكل نظام أساسي:
 *   • عدد مواده الرسمي (بعدّ عُقد statuteStructure من النوع 1 = مادة، تعاوديًا عبر items).
 *   • وجود لائحته التنفيذية (نتيجة بحث اسمها يحوي «لائحة») وعدد موادها.
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

async function apiPost(path, body) {
  return page.evaluate(
    async ({ url, body }) => {
      const r = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(body),
      });
      return { status: r.status, json: await r.json().catch(() => null) };
    },
    { url: `${BASE}${path}`, body }
  );
}
async function apiGet(path) {
  return page.evaluate(
    async (url) => {
      const r = await fetch(url, { headers: { accept: "application/json" } });
      return { status: r.status, json: await r.json().catch(() => null) };
    },
    `${BASE}${path}`
  );
}

function searchBody(keyword) {
  return {
    pageNumber: 1,
    pageSize: 20,
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
    keyword,
    isSearch: true,
    identityNumber: "",
  };
}

// حلّ الحقول دفاعيًا (لا نعرف الأسماء الحرفية يقينًا)
const pick = (o, keys) => { for (const k of keys) if (o && o[k] != null && o[k] !== "") return o[k]; return undefined; };
const serialOf = (it) => pick(it, ["serial", "Serial", "statuteSerial", "id", "serialNumber"]);
const nameOf = (it) => pick(it, ["name", "statuteName", "arabicName", "title", "nameAr"]) || "?";

// عدّ عُقد النوع 1 (مادة) تعاوديًا، مع تمييز ما تسلسله يبدأ بـ«المادة»
function countArticles(nodes) {
  let total = 0, labeled = 0;
  const walk = (arr) => {
    if (!Array.isArray(arr)) return;
    for (const n of arr) {
      if (n && n.type === 1) { total++; if (typeof n.sequence === "string" && n.sequence.includes("المادة")) labeled++; }
      if (n && Array.isArray(n.items)) walk(n.items);
    }
  };
  walk(nodes);
  return { total, labeled };
}

const isReg = (name) => /لائحة|اللائحة\s*التنفيذية|اللائحه/.test(name || "");

const SYSTEMS = [
  "نظام المعاملات المدنية",
  "نظام المرافعات الشرعية",
  "نظام الإثبات",
  "نظام الأحوال الشخصية",
  "نظام الإجراءات الجزائية",
  "نظام الشركات",
  "نظام المحاكم التجارية",
  "نظام العمل",
  "نظام الإفلاس",
  "نظام التوثيق",
  "نظام التحكيم",
];

async function articleCountFor(serial) {
  const d = await apiGet(`/statute/get-Statute-gateway-Detail?Serial=${encodeURIComponent(serial)}&identityNumber=`);
  const m = d.json?.model || {};
  const c = countArticles(m.statuteStructure);
  return { status: d.status, ...c, modelKeys: Object.keys(m) };
}

const OUT = [];
try {
  await page.goto("https://laws.moj.gov.sa/ar", { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(3000);

  let printedSchemaOnce = false;
  for (const sys of SYSTEMS) {
    console.log("\n" + "─".repeat(92));
    console.log("▮ " + sys);
    const res = await apiPost("/statute/section-search", searchBody(sys));
    const coll = res.json?.model?.collection || [];
    if (!printedSchemaOnce && coll[0]) {
      console.log("  (مخطّط عنصر النتيجة — مفاتيح):", Object.keys(coll[0]).join(", "));
      printedSchemaOnce = true;
    }
    console.log(`  نتائج البحث: ${coll.length}`);
    for (const it of coll) console.log(`    · «${nameOf(it)}» serial=${serialOf(it)}${isReg(nameOf(it)) ? " [لائحة]" : ""}`);

    // النظام الأصل: اسمه يبدأ بـ«نظام» ولا يحوي «لائحة»؛ فإن تعذّر فأقصر اسم غير لائحة
    const mains = coll.filter((it) => !isReg(nameOf(it)));
    const main =
      mains.find((it) => nameOf(it).replace(/\s+/g, " ").trim() === sys) ||
      mains.find((it) => nameOf(it).startsWith("نظام")) ||
      mains.sort((a, b) => nameOf(a).length - nameOf(b).length)[0];
    const regs = coll.filter((it) => isReg(nameOf(it)));

    const record = { system: sys, main: null, regulations: [] };
    if (main) {
      const s = serialOf(main);
      const ac = s ? await articleCountFor(s) : null;
      record.main = { name: nameOf(main), serial: s, official: ac };
      console.log(`  ★ النظام: «${nameOf(main)}» — مواد رسمية=${ac ? ac.total : "?"} (بعنوان «المادة»=${ac ? ac.labeled : "?"}) · modelKeys=${ac ? ac.modelKeys.join("|") : "?"}`);
    } else {
      console.log("  ❌ لم يُطابَق نظام أصل.");
    }
    for (const r of regs) {
      const s = serialOf(r);
      const ac = s ? await articleCountFor(s) : null;
      record.regulations.push({ name: nameOf(r), serial: s, official: ac });
      console.log(`  ⚖ لائحة: «${nameOf(r)}» — مواد رسمية=${ac ? ac.total : "?"}`);
    }
    OUT.push(record);
  }

  console.log("\n" + "═".repeat(92));
  console.log("JSON_RESULT_BEGIN");
  console.log(
    JSON.stringify(
      OUT.map((r) => ({
        system: r.system,
        mainName: r.main?.name ?? null,
        mainSerial: r.main?.serial ?? null,
        officialArticles: r.main?.official?.total ?? null,
        labeledArticles: r.main?.official?.labeled ?? null,
        regulations: r.regulations.map((x) => ({ name: x.name, serial: x.serial, articles: x.official?.total ?? null })),
      })),
      null,
      0
    )
  );
  console.log("JSON_RESULT_END");
} catch (e) {
  console.log("تعذّر:", e?.stack?.slice(0, 500) || e);
} finally {
  await browser.close();
}

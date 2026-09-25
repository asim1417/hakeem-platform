/**
 * moj-fetch-civil.mjs — جلب رسمي (قراءة فقط) لنظام المعاملات المدنية من بوابة العدل
 * للبحث عن المادة المفقودة 237 («إذا تعدد الدائنون في التزام غير قابل للانقسام»).
 * لا قاعدة بيانات. لا كتابة. استكشاف مصدر رسمي فقط (laws.moj.gov.sa).
 */
const { chromium } = await import("playwright");
const BASE = "https://laws-gateway.moj.gov.sa/apis/legislations/v1";
const TARGET = "نظام المعاملات المدنية";

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const ctx = await browser.newContext({
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
  locale: "ar-SA",
});
const page = await ctx.newPage();
const api = (path, opts) => page.evaluate(async ({ url, opts }) => {
  const r = await fetch(url, opts || { headers: { accept: "application/json" } });
  return { status: r.status, json: await r.json().catch(() => null) };
}, { url: `${BASE}${path}`, opts });

const htmlToText = (html) => (html || "")
  .replace(/<\s*br\s*\/?>/gi, "\n").replace(/<\/\s*(p|div|li|h[1-6])\s*>/gi, "\n")
  .replace(/<[^>]+>/g, "").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&")
  .replace(/[ \t]{2,}/g, " ").split("\n").map((l) => l.trim()).join("\n").trim();

try {
  await page.goto("https://laws.moj.gov.sa/ar", { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(2500);

  // ① اكتشاف serial للنظام عبر نقطة البحث الرسمية section-search.
  let serial = null;
  const body = {
    pageNumber: 1, pageSize: 30, term: "المعاملات المدنية",
    LegalStatue: null, classificationId: null, sortingBy: 7,
    statuteIssueDateFrom: null, statuteIssueDateTo: null,
    statuteName: "المعاملات المدنية", statutePublishDateFrom: null,
    statutePublishDateTo: null, statuteType: null, type: 1, identityNumber: "",
  };
  const res = await api("/statute/section-search", {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
  console.log(`  POST /statute/section-search → status=${res?.status}`);
  if (res?.json) {
    const stack = [res.json];
    const candidates = [];
    while (stack.length) {
      const o = stack.pop();
      if (Array.isArray(o)) { for (const x of o) stack.push(x); continue; }
      if (o && typeof o === "object") {
        const name = (o.name || o.title || o.statuteName || "").toString().trim();
        const s = o.serial || o.serialNumber || o.statuteSerial || null;
        if (name && s) candidates.push({ name, serial: s });
        for (const v of Object.values(o)) stack.push(v);
      }
    }
    console.log(`  مرشّحات: ${candidates.slice(0, 8).map((c) => c.name).join(" · ")}`);
    const exact = candidates.find((c) => c.name === TARGET) || candidates.find((c) => c.name.includes("المعاملات المدنية"));
    serial = exact?.serial || null;
    if (exact) console.log(`  ✓ «${exact.name}» serial=${serial}`);
  }

  if (!serial) { console.log("❌ لم يُعثر على serial للنظام في قوائم البوابة."); await browser.close(); process.exit(3); }

  // ② جلب التفاصيل واستخراج المواد.
  const d = await api(`/statute/get-Statute-gateway-Detail?Serial=${encodeURIComponent(serial)}&identityNumber=`);
  const m = d.json?.model || {};
  if (!Array.isArray(m.statuteStructure)) { console.log(`❌ تعذّر جلب التفاصيل status=${d.status}`); await browser.close(); process.exit(4); }

  const articles = [];
  let chapterCtx = null;
  const walk = (nodes, chapter) => {
    for (const n of nodes || []) {
      if (n && n.type === 1) articles.push({ label: (n.sequence || "").trim(), text: htmlToText(n.text), chapter: chapter || null });
      if (n && Array.isArray(n.items)) {
        const child = n.type !== 1 ? [chapter, [n.sequence, n.name].filter(Boolean).join(": ")].filter(Boolean).join(" › ") : chapter;
        walk(n.items, child);
      }
    }
  };
  walk(m.statuteStructure, null);
  console.log(`\n«${(m.name || "").trim()}» — مواد مستخرجة=${articles.length}`);

  // احفظ الالتقاط الرسمي الكامل مع provenance (قراءة فقط — لا قاعدة بيانات).
  const fs = await import("node:fs");
  const crypto = await import("node:crypto");
  const capture = {
    system: {
      name: (m.name || "").trim(),
      publisher: "وزارة العدل — البوابة القانونية",
      sourceUrl: `https://laws.moj.gov.sa/ar/legislation/${serial}`,
      sourceSerial: serial,
      issuanceDateH: (m.issuanceDate || "").slice(0, 10) || null,
      fetchedAt: new Date().toISOString(),
      officialArticleCount: articles.length,
    },
    articles: articles.map((a) => ({
      ordinalTitle: a.label,
      text: a.text,
      chapter: a.chapter,
      sha256: crypto.createHash("sha256").update(a.text, "utf8").digest("hex"),
    })),
  };
  fs.mkdirSync("data/backfill/official", { recursive: true });
  fs.writeFileSync("data/backfill/official/civil-madani-moj.json", JSON.stringify(capture, null, 2) + "\n", "utf8");
  console.log(`✓ حُفظ الالتقاط الرسمي: data/backfill/official/civil-madani-moj.json (${articles.length} مادة)`);

  // ③ ابحث عن المادة المفقودة.
  const creditors = articles.filter((a) => /تعدد\s+الدائن/.test(a.text) && /غير\s+قابل\s+للانقسام/.test(a.text));
  console.log(`\nمواد «تعدد الدائنين + غير قابل للانقسام»: ${creditors.length}`);
  for (const a of creditors) console.log(`  [${a.label}] ${a.text.slice(0, 160)}`);

  // اطبع المواد ذات التسمية 236/237/238 للمقارنة.
  for (const want of ["السادسة والثلاثون بعد المائتين", "السابعة والثلاثون بعد المائتين", "الثامنة والثلاثون بعد المائتين"]) {
    const a = articles.find((x) => x.label.includes(want));
    console.log(`\n[${want}] ${a ? "→ " + a.text.slice(0, 200) : "غير موجودة"}`);
  }
} catch (e) {
  console.log("تعذّر:", e?.message || e);
  process.exit(1);
} finally {
  await browser.close();
}

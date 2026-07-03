/**
 * moj-fetch-instruments.mjs — يسحب من بوابة العدل نصوص مواد الأدوات المرتبطة الإحدى‑عشرة المفقودة
 * (لوائح/أدلة/ضوابط/قواعد/آليات) بمعرّفاتها المؤكَّدة من المدقّق، ويكتب data/moj-instruments.json
 * + ملخّص تحقّق. قراءة من المصدر فقط — لا قاعدة بيانات. (نفس منطق moj-fetch-regs)
 *
 * الترقيم = ترتيب المصدر التسلسلي؛ التسمية الحقيقية في title. تجريد HTML فقط — لا تعديل قانوني.
 */
import { writeFileSync, mkdirSync } from "node:fs";
const { chromium } = await import("playwright");

// تشخيص فقط: هل التسمية رقم ترتيبي نظيف؟ (نسخة مطابقة لِـ import-hoqoqi-sql)
const AR_UNITS = { "اول": 1, "اولي": 1, "حادي": 1, "حاديه": 1, "واحد": 1, "واحده": 1, "ثاني": 2, "ثانيه": 2, "اثنان": 2, "اثنتان": 2, "ثالث": 3, "ثالثه": 3, "رابع": 4, "رابعه": 4, "خامس": 5, "خامسه": 5, "سادس": 6, "سادسه": 6, "سابع": 7, "سابعه": 7, "ثامن": 8, "ثامنه": 8, "تاسع": 9, "تاسعه": 9, "عاشر": 10, "عاشره": 10 };
const AR_TENS = { "عشرون": 20, "عشرين": 20, "ثلاثون": 30, "ثلاثين": 30, "اربعون": 40, "اربعين": 40, "خمسون": 50, "خمسين": 50, "ستون": 60, "ستين": 60, "سبعون": 70, "سبعين": 70, "ثمانون": 80, "ثمانين": 80, "تسعون": 90, "تسعين": 90 };
const AR_HUNDREDS = { "مايه": 100, "مايتان": 200, "مايتين": 200, "ثلاثمايه": 300, "اربعمايه": 400, "خمسمايه": 500, "ستمايه": 600, "سبعمايه": 700, "ثمانمايه": 800, "تسعمايه": 900 };
function parseArabicOrdinal(raw) {
  let s = (raw || "").replace(/[ً-ْٰـ]/g, "").replace(/[إأآ]/g, "ا").replace(/ئ/g, "ي").replace(/ؤ/g, "و").replace(/ء/g, "").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/[«»(){}\[\].,،؛:]/g, " ");
  s = s.replace(/الماده/g, " ").replace(/مكرر/g, " ");
  const words = s.split(/\s+/).map((w) => w.replace(/^و?ال/, "").replace(/^و/, "")).filter(Boolean);
  if (!words.length) return undefined;
  let hundreds = 0, tens = 0, units = 0, teen = 0, sawAny = false;
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (w in AR_HUNDREDS) { hundreds += AR_HUNDREDS[w]; sawAny = true; continue; }
    if (w === "بعد") continue;
    if (w in AR_TENS) { tens += AR_TENS[w]; sawAny = true; continue; }
    if (w in AR_UNITS) { const next = words[i + 1]; if (next === "عشر" || next === "عشره") { teen += 10 + AR_UNITS[w]; i++; sawAny = true; continue; } units += AR_UNITS[w]; sawAny = true; continue; }
    if (w === "عشر" || w === "عشره") { teen += 10; sawAny = true; continue; }
  }
  if (!sawAny) return undefined;
  const total = hundreds + tens + teen + units;
  return total > 0 ? total : undefined;
}

function htmlToText(html) {
  if (!html) return "";
  return html
    .replace(/<\s*br\s*\/?>/gi, "\n").replace(/<\/\s*(p|div|li|h[1-6])\s*>/gi, "\n").replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, '"').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ")
    .split("\n").map((l) => l.trim()).join("\n").trim();
}

// الأدوات الإحدى‑عشرة المفقودة (Serials مؤكَّدة من moj-related-audit).
const TARGETS = [
  { parent: "نظام المرافعات الشرعية", serial: "XxHJGQ-J8UHQHL_lpdKCVw" }, // لائحة قسمة الأموال المشتركة
  { parent: "نظام المرافعات الشرعية", serial: "314SBg_7tcu6IQv02z2tkQ" }, // اللائحة التنفيذية لإجراءات الاستئناف
  { parent: "نظام المرافعات الشرعية", serial: "7uUvC6c0BoKLJuwB021doA" }, // اللائحة التنفيذية لطرق الاعتراض على الأحكام
  { parent: "نظام الإثبات", serial: "4MlQ7qXft074z0DphE_Zmw" }, // ضوابط إجراءات الإثبات إلكترونياً
  { parent: "نظام الإثبات", serial: "ZNMI0PpA1fSRgK60lVLGEw" }, // الأدلة الإجرائية لنظام الإثبات
  { parent: "نظام الإثبات", serial: "IVuNhqeASR-irehY2BPMag" }, // القواعد الخاصة بتنظيم شؤون الخبرة أمام المحاكم
  { parent: "نظام الأحوال الشخصية", serial: "InZySyW64YqKkkChZ2dPQw" }, // لائحة التقارير الطبية
  { parent: "نظام الإجراءات الجزائية", serial: "GE-StIXcjF_Wfc2MFGx8ww" }, // آلية الاستعانة بمحام على نفقة الدولة
  { parent: "نظام المحاكم التجارية", serial: "xCbJni6ThD9OP5PQVEydMA" }, // القواعد المنظمة لإجراءات قضايا الإفلاس في المحاكم التجارية
  { parent: "نظام الإفلاس", serial: "p9K3NeTcz-honBTszlknag" }, // قواعد تحديد أتعاب الخبراء والأمناء في نظام الإفلاس
  { parent: "نظام الإفلاس", serial: "JqVX64FCZsPywIN66P7frg" }, // القواعد المنظمة لإجراءات الإفلاس العابرة للحدود
];

const BASE = "https://laws-gateway.moj.gov.sa/apis/legislations/v1";
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const ctx = await browser.newContext({ userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36", locale: "ar-SA" });
const page = await ctx.newPage();
const apiGet = (path) => page.evaluate(async (url) => { const r = await fetch(url, { headers: { accept: "application/json" } }); return { status: r.status, json: await r.json().catch(() => null) }; }, `${BASE}${path}`);

const OUT = [];
try {
  await page.goto("https://laws.moj.gov.sa/ar", { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(3000);

  for (const t of TARGETS) {
    console.log("\n" + "─".repeat(92) + `\n▮ ${t.parent} ← serial=${t.serial}`);
    const d = await apiGet(`/statute/get-Statute-gateway-Detail?Serial=${encodeURIComponent(t.serial)}&identityNumber=`);
    const m = d.json?.model || {};
    const lawName = (m.name || "").trim();
    if (!lawName || !Array.isArray(m.statuteStructure)) { console.log(`   ❌ تعذّر جلب التفاصيل (status=${d.status}).`); continue; }

    const articles = [];
    let seq = 0;
    const walk = (nodes, chapterLabel) => {
      for (const n of nodes || []) {
        if (n && n.type === 1) {
          seq += 1;
          const label = (n.sequence || "").trim();
          const content = htmlToText(n.text);
          articles.push({ articleNumber: seq, title: label || `المادة ${seq}`, content, chapter: chapterLabel || null, royalDecree: (n.decree || "").trim() || null, _label: label, _matchesOrdinal: parseArabicOrdinal(label) === seq, _len: content.length });
        }
        if (n && Array.isArray(n.items) && n.items.length) {
          const childChapter = n.type !== 1 ? [chapterLabel, [n.sequence, n.name].filter(Boolean).join(": ")].filter(Boolean).join(" › ") : chapterLabel;
          walk(n.items, childChapter);
        }
      }
    };
    walk(m.statuteStructure, null);

    const ordinalMatch = articles.filter((a) => a._matchesOrdinal).length;
    const empty = articles.filter((a) => a._len < 10).length;
    console.log(`   «${lawName}» · تصنيف=${m.classificationName ?? "∅"} · إصدار هـ=${(m.issuanceDate || "").slice(0, 10) || "∅"}`);
    console.log(`   مواد=${articles.length} · تسلسلي(يطابق الترتيبي ${ordinalMatch}/${articles.length}) · نصّ فارغ=${empty}`);
    if (!articles.length) console.log("   ⚠ لا مواد مُنظَّمة (قد لا تحمل بنية مواد) — ستُتخطّى عند الإدراج.");
    else console.log(`   أول: «${articles[0]._label}» — ${articles[0].content.slice(0, 70)}…`);

    OUT.push({
      system: { name: lawName, classification: m.classificationName ?? null, parentSystem: t.parent, sourceSerial: t.serial, sourceUrl: `https://laws.moj.gov.sa/ar/legislation/${t.serial}`, issuanceDateH: (m.issuanceDate || "").slice(0, 10) || null, officialArticleCount: articles.length },
      articles: articles.map(({ _label, _matchesOrdinal, _len, ...a }) => a),
    });
  }

  mkdirSync("data", { recursive: true });
  writeFileSync("data/moj-instruments.json", JSON.stringify(OUT, null, 2) + "\n");
  console.log("\n" + "═".repeat(92));
  console.log(`✓ كُتب data/moj-instruments.json — ${OUT.length} أداة، إجمالي مواد=${OUT.reduce((s, r) => s + r.articles.length, 0)}، بمواد=${OUT.filter((r) => r.articles.length).length}`);
} catch (e) {
  console.log("تعذّر:", e?.stack?.slice(0, 500) || e);
  process.exit(1);
} finally {
  await browser.close();
}

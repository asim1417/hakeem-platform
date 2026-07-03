/**
 * moj-fetch-regs.mjs — يسحب من بوابة العدل القانونية نصوص مواد اللوائح التنفيذية الأربع المفقودة،
 * ويكتب data/moj-regs.json (مصدر رسمي قابل للمراجعة) + ملخّص تحقّق. قراءة فقط — لا قاعدة بيانات.
 *
 * التطبيع: تجريد HTML فقط (طبقة عرض)؛ نصّ المادة يُحفظ كما ورد حرفيًّا — لا تعديل قانوني.
 * رقم المادة: من العنوان الترتيبي («المادة الحادية والثلاثون») عبر parseArabicOrdinal، مع
 *            تسلسل احتياطي مضمون التفرّد عند التعذّر/التصادم (مثل «مكرر»).
 */
import { writeFileSync, mkdirSync } from "node:fs";

const { chromium } = await import("playwright");

// ── تحويل العنوان الترتيبي العربي إلى رقم (نسخة مطابقة لِـ import-hoqoqi-sql.ts) ──
const AR_UNITS = { "اول": 1, "اولي": 1, "حادي": 1, "حاديه": 1, "واحد": 1, "واحده": 1, "ثاني": 2, "ثانيه": 2, "اثنان": 2, "اثنتان": 2, "ثالث": 3, "ثالثه": 3, "رابع": 4, "رابعه": 4, "خامس": 5, "خامسه": 5, "سادس": 6, "سادسه": 6, "سابع": 7, "سابعه": 7, "ثامن": 8, "ثامنه": 8, "تاسع": 9, "تاسعه": 9, "عاشر": 10, "عاشره": 10 };
const AR_TENS = { "عشرون": 20, "عشرين": 20, "ثلاثون": 30, "ثلاثين": 30, "اربعون": 40, "اربعين": 40, "خمسون": 50, "خمسين": 50, "ستون": 60, "ستين": 60, "سبعون": 70, "سبعين": 70, "ثمانون": 80, "ثمانين": 80, "تسعون": 90, "تسعين": 90 };
const AR_HUNDREDS = { "مايه": 100, "مايتان": 200, "مايتين": 200, "ثلاثمايه": 300, "اربعمايه": 400, "خمسمايه": 500, "ستمايه": 600, "سبعمايه": 700, "ثمانمايه": 800, "تسعمايه": 900 };
function parseArabicOrdinal(raw) {
  let s = (raw || "").replace(/[ً-ْٰـ]/g, "").replace(/[إأآ]/g, "ا").replace(/ئ/g, "ي").replace(/ؤ/g, "و").replace(/ء/g, "").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/[«»(){}\[\].,،؛]/g, " ");
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

// تجريد HTML إلى نصّ عربي نظيف مع الحفاظ على فقرات/أسطر المصدر
function htmlToText(html) {
  if (!html) return "";
  return html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/\s*(p|div|li|h[1-6])\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, '"').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ")
    .split("\n").map((l) => l.trim()).join("\n").trim();
}

// اللوائح الأربع المفقودة (Serials مؤكَّدة من التحقّق الرسمي — reports/moj-core-systems.md)
const REGS = [
  { parent: "نظام المحاكم التجارية", serial: "AOQoW16lDlm3PYZCshWpNw" },
  { parent: "نظام التوثيق", serial: "o7IAhRJFBAF2F4r_7fwXZA" },
  { parent: "نظام الأحوال الشخصية", serial: "41zDyO33ty4qZnGWAhpbNg" },
  { parent: "نظام المرافعات الشرعية", serial: "3PpcH7Pox63dH0Jw82s-UA" },
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

  for (const reg of REGS) {
    console.log("\n" + "─".repeat(92) + `\n▮ لائحة ${reg.parent} — serial=${reg.serial}`);
    const d = await apiGet(`/statute/get-Statute-gateway-Detail?Serial=${encodeURIComponent(reg.serial)}&identityNumber=`);
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
          // الترقيم = ترتيب المصدر (يساوي الرقم الحقيقي في اللوائح المرقّمة تسلسليًّا، ويحفظ
          // الترتيب في المزدوجة «١/٢٤٢»)؛ الرقم الحقيقي/التسمية يبقى في title. مضمون التفرّد.
          const num = seq;
          const parsed = parseArabicOrdinal(label); // تشخيص فقط: هل التسمية رقم ترتيبي نظيف؟
          const content = htmlToText(n.text);
          articles.push({
            articleNumber: num,
            title: label || `المادة ${num}`,
            content,
            chapter: chapterLabel || null,
            royalDecree: (n.decree || "").trim() || null,
            _seq: seq,
            _label: label,
            _matchesOrdinal: parsed === seq,
            _len: content.length,
          });
        }
        if (n && Array.isArray(n.items) && n.items.length) {
          const isContainer = n.type !== 1;
          const childChapter = isContainer ? [chapterLabel, [n.sequence, n.name].filter(Boolean).join(": ")].filter(Boolean).join(" › ") : chapterLabel;
          walk(n.items, childChapter);
        }
      }
    };
    walk(m.statuteStructure, null);

    const ordinalMatch = articles.filter((a) => a._matchesOrdinal).length;
    const empty = articles.filter((a) => a._len < 10).length;
    console.log(`   «${lawName}» · تصنيف=${m.classificationName ?? "∅"} · إصدار هـ=${(m.issuanceDate || "").slice(0, 10) || "∅"}`);
    console.log(`   مواد مستخرجة=${articles.length} · ترقيم تسلسلي (يطابق الترتيبي العربي في ${ordinalMatch}/${articles.length}) · نصّ شبه فارغ=${empty}`);
    if (articles[0]) console.log(`   أول: «${articles[0]._label}» (#${articles[0].articleNumber}) — ${articles[0].content.slice(0, 80)}…`);
    if (articles.at(-1)) console.log(`   آخر: «${articles.at(-1)._label}» (#${articles.at(-1).articleNumber})`);

    OUT.push({
      system: {
        name: lawName,
        classification: m.classificationName ?? null,
        parentSystem: reg.parent,
        sourceSerial: reg.serial,
        sourceUrl: `https://laws.moj.gov.sa/ar/legislation/${reg.serial}`,
        issuanceDateH: (m.issuanceDate || "").slice(0, 10) || null,
        officialArticleCount: articles.length,
      },
      articles: articles.map(({ _seq, _label, _matchesOrdinal, _len, ...a }) => a),
    });
  }

  mkdirSync("data", { recursive: true });
  writeFileSync("data/moj-regs.json", JSON.stringify(OUT, null, 2) + "\n");
  console.log("\n" + "═".repeat(92));
  console.log(`✓ كُتب data/moj-regs.json — ${OUT.length} لوائح، إجمالي مواد=${OUT.reduce((s, r) => s + r.articles.length, 0)}`);
} catch (e) {
  console.log("تعذّر:", e?.stack?.slice(0, 500) || e);
  process.exit(1);
} finally {
  await browser.close();
}

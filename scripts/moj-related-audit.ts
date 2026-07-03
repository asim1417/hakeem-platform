/**
 * moj-related-audit.ts — يجمع من بوابة العدل كل الأدوات القانونية المرتبطة بكل نظام أساسي
 * (لوائح/أدلة/ضوابط/قواعد… عبر relatedLegal + otherRelatedLegal + بحث الاسم)، ويقارنها بالقاعدة
 * ليُظهر ما هو «موجود» وما هو «مفقود». قراءة فقط (SELECT فقط) — لا كتابة.
 *
 * يُشغَّل عبر workflow يوفّر Playwright + NEON_DATABASE_URL (قراءة).
 */
import { prisma } from "@/lib/prisma";
import { chromium } from "playwright";

const BASE = "https://laws-gateway.moj.gov.sa/apis/legislations/v1";

// الركائز التسعة المستضافة على بوابة العدل (Serials مؤكَّدة).
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

function norm(s: string): string {
  return (s || "").replace(/[ً-ْٰـ]/g, "").replace(/[إأآ]/g, "ا").replace(/ئ/g, "ي").replace(/ؤ/g, "و").replace(/ء/g, "").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/\s+/g, " ").trim();
}
const kindOf = (name: string): string => {
  const n = norm(name);
  if (/لايحه تنفيذيه|اللايحه التنفيذيه|لوايح تنفيذيه/.test(n)) return "لائحة تنفيذية";
  if (/لايحه|لوايح/.test(n)) return "لائحة";
  if (/دليل|ادله/.test(n)) return "دليل";
  if (/ضوابط/.test(n)) return "ضوابط";
  if (/قواعد/.test(n)) return "قواعد";
  if (/تعليمات|تعميم/.test(n)) return "تعليمات";
  if (/^نظام/.test(n)) return "نظام";
  return "أخرى";
};

async function main() {
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  const ctx = await browser.newContext({ userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36", locale: "ar-SA" });
  const page = await ctx.newPage();
  const apiGet = (path: string) => page.evaluate(async (url) => { const r = await fetch(url, { headers: { accept: "application/json" } }); return { status: r.status, json: await r.json().catch(() => null) }; }, `${BASE}${path}`);

  await page.goto("https://laws.moj.gov.sa/ar", { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(3000);

  type Item = { name: string; serial: string | null; typeName: string | null; via: string };
  const perSystem: Array<{ system: string; items: Item[] }> = [];
  let dumpedShape = false;

  for (const c of CORE) {
    const d = await apiGet(`/statute/get-Statute-gateway-Detail?Serial=${encodeURIComponent(c.serial)}&identityNumber=`);
    const m = d.json?.model ?? {};
    const items: Item[] = [];
    // relatedLegal (مفرد)
    if (m.relatedLegalName) items.push({ name: String(m.relatedLegalName).trim(), serial: m.relatedLegalSerial ?? null, typeName: m.relatedLegalTypeName ?? null, via: "relatedLegal" });
    // otherRelatedLegal (مصفوفة) — قد تحوي لوائح/أدلة/ضوابط
    const other = m.otherRelatedLegal;
    if (!dumpedShape && Array.isArray(other) && other.length) {
      console.log("مخطّط عنصر otherRelatedLegal (مفاتيح):", Object.keys(other[0]).join(", "));
      dumpedShape = true;
    }
    if (Array.isArray(other)) {
      for (const o of other) {
        const name = (o?.name ?? o?.statuteName ?? o?.title ?? o?.relatedLegalName ?? "").toString().trim();
        if (name) items.push({ name, serial: o?.serial ?? o?.relatedLegalSerial ?? o?.id ?? null, typeName: o?.legalTypeName ?? o?.typeName ?? o?.relatedLegalTypeName ?? null, via: "otherRelatedLegal" });
      }
    }
    // إزالة التكرار بالاسم المُطبَّع
    const uniq = new Map<string, Item>();
    for (const it of items) if (!uniq.has(norm(it.name))) uniq.set(norm(it.name), it);
    perSystem.push({ system: c.name, items: [...uniq.values()] });
  }
  await browser.close();

  // مقارنة بالقاعدة (ILIKE على الاسم) — قراءة فقط
  console.log("═".repeat(96));
  console.log("الأدوات المرتبطة رسميًّا بكل نظام (relatedLegal + otherRelatedLegal) ومطابقتها بالقاعدة");
  console.log("═".repeat(96));

  const summary: Array<{ name: string; kind: string; system: string; inDb: boolean; dbArticles: number }> = [];
  for (const s of perSystem) {
    console.log(`\n▮ ${s.system} — ${s.items.length} أداة مرتبطة`);
    if (!s.items.length) { console.log("   (لا شيء مرتبط)"); continue; }
    for (const it of s.items) {
      const kind = kindOf(it.name);
      // مطابقة القاعدة: نظام يحمل هذا الاسم (تطبيع بسيط عبر ILIKE على صور الهمزة الشائعة)
      const rows = await prisma.$queryRawUnsafe<Array<{ name: string; c: bigint }>>(
        `SELECT s.name, count(a.id)::bigint AS c
         FROM legal_systems s LEFT JOIN legal_articles a ON a."legalSystemId" = s.id
         WHERE s.name ILIKE $1 OR s.name ILIKE $2
         GROUP BY s.name ORDER BY c DESC LIMIT 1`,
        it.name,
        it.name.replace(/[أإآ]/g, "ا")
      );
      const inDb = rows.length > 0;
      const dbArticles = inDb ? Number(rows[0].c) : 0;
      summary.push({ name: it.name, kind, system: s.system, inDb, dbArticles });
      console.log(`   ${inDb ? "✅" : "❌"} [${kind}] «${it.name}»${it.typeName ? ` · نوع=${it.typeName}` : ""} · via=${it.via}${inDb ? ` · DB مواد=${dbArticles}` : " · مفقود"}`);
    }
  }

  // خلاصة المفقود
  const missing = summary.filter((x) => !x.inDb);
  console.log("\n" + "═".repeat(96));
  console.log(`إجمالي الأدوات المرتبطة الفريدة: ${summary.length} · موجود=${summary.length - missing.length} · مفقود=${missing.length}`);
  if (missing.length) {
    console.log("\nالمفقود من القاعدة:");
    for (const x of missing) console.log(`   ❌ [${x.kind}] «${x.name}»  (مرتبط بـ ${x.system})`);
  } else {
    console.log("لا شيء مفقود — كل الأدوات المرتبطة رسميًّا موجودة في القاعدة.");
  }

  console.log("\nJSON_RESULT_BEGIN");
  console.log(JSON.stringify({ summary, missing }, null, 0));
  console.log("JSON_RESULT_END");
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e instanceof Error ? e.stack : e); await prisma.$disconnect().catch(() => {}); process.exit(1); });

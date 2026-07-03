/**
 * moj-related-check.ts — يقرأ JSON الأدوات المرتبطة (من moj-related-fetch.mjs) ويقارن كلًّا
 * بالقاعدة (ILIKE، SELECT فقط) ليُظهر «موجود/مفقود» مع تصنيف الأداة. قراءة فقط.
 *   الاستعمال: node moj-related-fetch.mjs > related.json && tsx moj-related-check.ts related.json
 */
import { readFileSync } from "node:fs";
import { prisma } from "@/lib/prisma";

type Item = { name: string; serial: string | null; typeName: string | null; via: string };
type Group = { system: string; serial: string; items: Item[] };

function norm(s: string): string {
  return (s || "").replace(/[ً-ْٰـ]/g, "").replace(/[إأآ]/g, "ا").replace(/ئ/g, "ي").replace(/ؤ/g, "و").replace(/ء/g, "").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/\s+/g, " ").trim();
}
function kindOf(name: string): string {
  const n = norm(name);
  if (/لايحه تنفيذيه|اللايحه التنفيذيه|لوايح تنفيذيه/.test(n)) return "لائحة تنفيذية";
  if (/لايحه|لوايح/.test(n)) return "لائحة";
  if (/دليل|ادله/.test(n)) return "دليل";
  if (/ضوابط/.test(n)) return "ضوابط";
  if (/قواعد/.test(n)) return "قواعد";
  if (/تعليمات|تعميم/.test(n)) return "تعليمات";
  if (/^نظام/.test(n)) return "نظام";
  return "أخرى";
}

async function main() {
  const path = process.argv[2] || "related.json";
  const groups = JSON.parse(readFileSync(path, "utf8")) as Group[];

  console.log("═".repeat(96));
  console.log("الأدوات المرتبطة رسميًّا بكل نظام (relatedLegal + otherRelatedLegal) ومطابقتها بالقاعدة");
  console.log("═".repeat(96));

  const summary: Array<{ name: string; kind: string; system: string; serial: string | null; inDb: boolean; dbArticles: number }> = [];
  for (const g of groups) {
    console.log(`\n▮ ${g.system} — ${g.items.length} أداة مرتبطة`);
    if (!g.items.length) { console.log("   (لا شيء مرتبط في البوابة)"); continue; }
    for (const it of g.items) {
      const kind = kindOf(it.name);
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
      summary.push({ name: it.name, kind, system: g.system, serial: it.serial, inDb, dbArticles });
      console.log(`   ${inDb ? "✅" : "❌"} [${kind}] «${it.name}»${it.typeName ? ` · نوع=${it.typeName}` : ""}${inDb ? ` · DB مواد=${dbArticles}` : " · مفقود"}`);
    }
  }

  const missing = summary.filter((x) => !x.inDb);
  console.log("\n" + "═".repeat(96));
  console.log(`إجمالي الأدوات المرتبطة الفريدة: ${summary.length} · موجود=${summary.length - missing.length} · مفقود=${missing.length}`);
  if (missing.length) {
    console.log("\nالمفقود من القاعدة (بمعرّفاتها للإدراج):");
    for (const x of missing) console.log(`   ❌ [${x.kind}] «${x.name}» · serial=${x.serial ?? "∅"} · (مرتبط بـ ${x.system})`);
  } else {
    console.log("لا شيء مفقود — كل الأدوات المرتبطة رسميًّا موجودة في القاعدة.");
  }
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e instanceof Error ? e.message : e); await prisma.$disconnect().catch(() => {}); process.exit(1); });

/**
 * analyze-hoqoqi-vs-db.ts — تحليل عميق للمصدر الأصلي hoqoqi.sql ومقارنته بقاعدة بيانات المنصّة.
 * يجيب: ماذا نستفيد من المصدر؟ ملاحظات؟ إضافات غير مُستغلّة؟ أخطاء/فجوات؟
 *
 * قراءة فقط: يقرأ المصدر (ملف) ويقرأ Neon (SELECT فقط عبر prisma count). لا كتابة إطلاقًا.
 * التشغيل: tsx scripts/analyze-hoqoqi-vs-db.ts --file=hoqoqi.sql   (يتطلب DATABASE_URL للمقارنة)
 */
import fs from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type SqlRow = Record<string, string | number | null>;
// كل الجداول التي قد تحمل قيمة — نوسّع القائمة لاكتشاف الغِنى غير المُستغَلّ
const wantTables = [
  "laws", "laws_lang", "lang_laws",
  "law_articles", "law_articles_lang", "lang_articles_law",
  "law_categories", "law_categories_lang", "lang_categories_law",
  "law_chapters", "law_chapters_lang", "lang_chapters_law",
  "tools_issuance_law", "amendment_articles_law", "nouns", "verbs",
];

function unescapeSqlChar(c: string) { return ({ n: "\n", r: "\r", t: "\t", "0": "\0" } as Record<string, string>)[c] ?? c; }
function coerce(v: string): string | number | null {
  const t = v.trim();
  if (!t || /^null$/i.test(t)) return null;
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  return t;
}
function parseValues(sql: string) {
  const rows: Array<Array<string | number | null>> = [];
  let row: Array<string | number | null> = [], val = "", inStr = false, esc = false, inRow = false;
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    if (inStr) {
      if (esc) { val += unescapeSqlChar(c); esc = false; }
      else if (c === "\\") esc = true;
      else if (c === "'") inStr = false;
      else val += c;
      continue;
    }
    if (c === "'") { inStr = true; continue; }
    if (c === "(" && !inRow) { inRow = true; row = []; val = ""; continue; }
    if (c === "," && inRow) { row.push(coerce(val)); val = ""; continue; }
    if (c === ")" && inRow) { row.push(coerce(val)); rows.push(row); row = []; val = ""; inRow = false; continue; }
    if (inRow) val += c;
  }
  return rows;
}
function parseAll(sql: string) {
  const tables = new Map<string, SqlRow[]>();
  const createNames = Array.from(sql.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`?([A-Za-z0-9_]+)`?/gi)).map((m) => m[1]);
  const re = /INSERT\s+INTO\s+`?([A-Za-z0-9_]+)`?\s*(?:\(([^)]+)\))?\s*VALUES\s*([\s\S]*?);/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql))) {
    const table = m[1];
    if (!wantTables.includes(table)) continue;
    const cols = m[2]?.split(",").map((c) => c.replace(/[`"' ]/g, "").trim()) ?? [];
    const rows = parseValues(m[3]).map((vals) => { const o: SqlRow = {}; vals.forEach((v, i) => (o[cols[i] || `c${i}`] = v)); return o; });
    tables.set(table, [...(tables.get(table) ?? []), ...rows]);
  }
  return { tables, createNames: Array.from(new Set(createNames)) };
}
function pick(row: SqlRow, keys: string[]) {
  const n = new Map(Object.entries(row).map(([k, v]) => [k.toLowerCase(), v]));
  for (const k of keys) if (n.has(k.toLowerCase())) return n.get(k.toLowerCase());
  return undefined;
}
function sv(v: unknown) { return v === null || v === undefined ? "" : String(v).trim(); }
function parseArabicInt(s: string): number | null {
  const en = s.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
  const m = en.match(/-?\d+/);
  return m ? Number(m[0]) : null;
}
const ARLATIN = /[A-Za-z]/g;
const AR = /[ء-غف-يٮ-ۓ]/g;
const ZW = /[​-‍⁠﻿­]/;

async function main() {
  const fileArg = process.argv.find((a) => a.startsWith("--file="))?.slice(7);
  const file = fileArg || process.env.HOQOQI_FILE || "hoqoqi.sql";
  const buf = await fs.readFile(path.resolve(file));
  const { tables, createNames } = parseAll(buf.toString("utf8"));

  const B = "=".repeat(80);
  console.log(B); console.log(`تحليل المصدر hoqoqi.sql (${(buf.length / 1048576).toFixed(2)}MB) مقابل قاعدة المنصّة`); console.log(B);

  console.log(`\nجداول في المصدر (${createNames.length}): ${createNames.join(", ")}`);
  console.log("صفوف الجداول ذات القيمة:");
  for (const t of wantTables) { const n = tables.get(t)?.length ?? 0; if (n) console.log(`  ${t}: ${n}`); }

  // ── المصدر: الأنظمة ──
  const laws = tables.get("laws") ?? [];
  const lawLang = [...(tables.get("laws_lang") ?? []), ...(tables.get("lang_laws") ?? [])];
  const lawNames = new Map<string, string>();
  for (const r of lawLang) { const id = sv(pick(r, ["law_id", "id_law", "laws_id"])); const nm = sv(pick(r, ["name", "title", "law_name", "lang_name", "ar_name"])); if (id && nm && !lawNames.has(id)) lawNames.set(id, nm); }
  const lawsWithName = laws.filter((r) => lawNames.has(sv(pick(r, ["id", "law_id", "id_law", "laws_id"])))).length;

  // ── المصدر: المواد + لغة المواد (كشف ازدواج اللغة) ──
  const base = tables.get("law_articles") ?? [];
  const langRows = [...(tables.get("law_articles_lang") ?? []), ...(tables.get("lang_articles_law") ?? [])];
  const langCols = langRows.length ? Object.keys(langRows[0]) : [];
  const langKey = ["lang", "locale", "language", "lang_code"].find((k) => langCols.map((c) => c.toLowerCase()).includes(k));
  const langDist = new Map<string, number>();
  if (langKey) for (const r of langRows) { const v = sv(pick(r, [langKey])) || "∅"; langDist.set(v, (langDist.get(v) ?? 0) + 1); }
  // أول صف لغة لكل مادة (يطابق سلوك المُستورِد: أول-يفوز)
  const firstLang = new Map<string, SqlRow>();
  for (const r of langRows) { const aid = sv(pick(r, ["article_id", "id_article", "law_article_id"])); if (aid && !firstLang.has(aid)) firstLang.set(aid, r); }

  let withContent = 0, withTitle = 0, withChapter = 0, withCategory = 0, noSystem = 0, unparseNum = 0, englishFirst = 0, zwArticles = 0;
  const seenKey = new Set<string>(); let dupKey = 0;
  const dropNoContent = new Set<string>(), dropNoSystem = new Set<string>(), dropNoNum = new Set<string>();
  for (const row of base) {
    const sid = sv(pick(row, ["id", "article_id", "id_article", "law_article_id"]));
    const sys = sv(pick(row, ["law_id", "id_law", "laws_id", "system_id"]));
    const cat = sv(pick(row, ["category_id", "law_category_id", "id_category"]));
    const lang = firstLang.get(sid);
    const content = sv(pick(lang ?? {}, ["content", "text", "article", "article_text", "body", "lang_text"]));
    const title = sv(pick(lang ?? {}, ["title", "name", "article_title", "lang_title"]));
    const numText = sv(pick(row, ["article_number", "number", "no", "article_no", "sort", "order"])) || title || sid;
    const num = parseArabicInt(numText);
    if (content) withContent++; else dropNoContent.add(sid);
    if (title) withTitle++;
    if (sv(pick(row, ["chapter", "section", "part", "door", "bab", "chapter_id"]))) withChapter++;
    if (cat) withCategory++;
    if (!sys) { noSystem++; dropNoSystem.add(sid); }
    if (num === null || num === 0) { unparseNum++; dropNoNum.add(sid); }
    if (content && ZW.test(content)) zwArticles++;
    // كشف: هل النصّ المختار إنجليزيّ؟ (لاتيني > عربي)
    if (content) { const la = (content.match(ARLATIN) || []).length, ar = (content.match(AR) || []).length; if (la > ar && la > 20) englishFirst++; }
    // ازدواج (نظام, رقم) — قيد الوحدة في القاعدة
    const lawName = lawNames.get(sys) || sys;
    if (num !== null) { const k = `${lawName}#${num}`; if (seenKey.has(k)) dupKey++; else seenKey.add(k); }
  }
  const wouldImport = base.filter((row) => {
    const sys = sv(pick(row, ["law_id", "id_law", "laws_id", "system_id"]));
    const sid = sv(pick(row, ["id", "article_id", "id_article", "law_article_id"]));
    const content = sv(pick(firstLang.get(sid) ?? {}, ["content", "text", "article", "article_text", "body", "lang_text"]));
    const numText = sv(pick(row, ["article_number", "number", "no", "article_no", "sort", "order"])) || sid;
    const num = parseArabicInt(numText);
    return sys && content && num !== null && num !== 0;
  }).length;

  const cats = tables.get("law_categories") ?? [];
  const chapters = tables.get("law_chapters") ?? [];
  const amendments = tables.get("amendment_articles_law") ?? [];
  const issuance = tables.get("tools_issuance_law") ?? [];
  const nouns = tables.get("nouns") ?? [];
  const verbs = tables.get("verbs") ?? [];

  console.log(`\n── المصدر ──`);
  console.log(`أنظمة (laws): ${laws.length} · باسم عربي: ${lawsWithName}`);
  console.log(`مواد (law_articles): ${base.length} · بنصّ: ${withContent} · بعنوان: ${withTitle} · بباب: ${withChapter} · بتصنيف: ${withCategory}`);
  if (langKey) console.log(`عمود لغة المواد «${langKey}» → ${[...langDist.entries()].map(([k, v]) => `${k}:${v}`).join(" · ")}`);
  console.log(`تصنيفات: ${cats.length} · أبواب/فصول: ${chapters.length} · تعديلات: ${amendments.length} · أدوات إصدار/مراسيم: ${issuance.length} · معجم(أسماء/أفعال): ${nouns.length}/${verbs.length}`);
  console.log(`قابلة للاستيراد وفق مرشّحات المُستورِد (نظام+نصّ+رقم صحيح): ${wouldImport} من ${base.length}`);

  // ── قاعدة المنصّة ──
  let db: Record<string, number> = {};
  let dbOk = false;
  if (process.env.DATABASE_URL) {
    try {
      const [systems, articles, hoqoqiKw, orphan, withDecree, withEffective, withChap, withClass, needsReview] = await Promise.all([
        prisma.legalSystem.count(),
        prisma.legalArticle.count(),
        prisma.legalArticle.count({ where: { keywords: { has: "source:hoqoqi_sql" } } }),
        prisma.legalArticle.count({ where: { legalSystemId: null } }),
        prisma.legalArticle.count({ where: { NOT: { royalDecree: null } } }),
        prisma.legalArticle.count({ where: { NOT: { effectiveFrom: null } } }),
        prisma.legalArticle.count({ where: { NOT: { chapter: null } } }),
        prisma.legalArticle.count({ where: { NOT: { classification: null } } }),
        prisma.legalArticle.count({ where: { keywords: { has: "review:needs_review" } } }),
      ]);
      db = { systems, articles, hoqoqiKw, orphan, withDecree, withEffective, withChap, withClass, needsReview };
      dbOk = true;
    } catch (e) { console.log(`\n(تعذّرت قراءة القاعدة: ${e instanceof Error ? e.message.slice(0, 120) : e})`); }
  } else console.log("\n(بلا DATABASE_URL — قسم المقارنة مع القاعدة مُتخطّى)");

  if (dbOk) {
    console.log(`\n── قاعدة المنصّة (Neon، قراءة فقط) ──`);
    console.log(`أنظمة: ${db.systems} · مواد: ${db.articles} · منها من hoqoqi: ${db.hoqoqiKw}`);
    console.log(`مواد بلا نظام (يتيمة): ${db.orphan} · بمرسوم: ${db.withDecree} · بتاريخ نفاذ: ${db.withEffective} · بباب: ${db.withChap} · بتصنيف: ${db.withClass} · «بحاجة مراجعة»: ${db.needsReview}`);
  }

  // ── الخلاصات ──
  console.log(`\n${B}\n📌 ملاحظات / إضافات / أخطاء\n${B}`);

  console.log(`\n🟦 ملاحظات:`);
  console.log(`  • المصدر يضمّ ${laws.length} نظامًا و${base.length} مادة (${withContent} بنصّ)، جودة النصّ نظيفة (0 التصاق حقيقي سابقًا).`);
  if (dbOk) console.log(`  • القاعدة تحمل ${db.articles} مادة و${db.systems} نظامًا؛ الفجوة عن المصدر = ${base.length - db.articles} مادة (${((1 - db.articles / base.length) * 100).toFixed(1)}%).`);
  if (langKey && langDist.size > 1) console.log(`  • جدول لغة المواد متعدّد اللغات (${[...langDist.keys()].join("/")}) — يجب ضمان اختيار العربية لا الإنجليزية.`);

  console.log(`\n🟩 إضافات غير مُستغَلّة (موجودة في المصدر، يمكن ضخّها):`);
  if (chapters.length) console.log(`  • بنية الأبواب/الفصول: ${chapters.length} فصلًا — لإظهار هيكل النظام (باب ← فصل ← مادة) بدل قائمة مسطّحة.`);
  if (cats.length) console.log(`  • التصنيفات: ${cats.length} تصنيفًا — لملء classification/domain لكل نظام.`);
  if (amendments.length) console.log(`  • التعديلات التاريخية: ${amendments.length} سجلًّا — لإظهار «مادة مُعدّلة/تاريخ التعديل» (يخدم فرق حكيم عن قانونية).`);
  if (issuance.length) console.log(`  • أدوات الإصدار/المراسيم: ${issuance.length} سجلًّا — لملء royalDecree/effectiveFrom (الآن ${dbOk ? db.withDecree : "?"} فقط بمرسوم).`);
  if (nouns.length + verbs.length) console.log(`  • معجم قانوني (${nouns.length} اسم + ${verbs.length} فعل) — لإثراء البحث/المكنز (thesaurus) بمرادفات مصدرها رسميّ.`);
  const enName = langKey ? (langDist.get("en") ?? langDist.get("english") ?? 0) : 0;
  if (enName) console.log(`  • ترجمات إنجليزية للمواد (~${enName} صفًّا) — لملء textEn وخدمة الواجهة ثنائية اللغة.`);

  console.log(`\n🟥 أخطاء/فجوات تحتاج معالجة:`);
  console.log(`  • مواد يُسقطها الاستيراد: بلا نظام=${dropNoSystem.size} · بلا نصّ=${dropNoContent.size} · رقم غير صالح=${dropNoNum.size} (اتحادها ≈ ${base.length - wouldImport} مادة مفقودة).`);
  if (dupKey) console.log(`  • تصادم (نظام, رقم مادة): ${dupKey} حالة — قيد الوحدة @@unique([lawName, articleNumber]) يجعل الاستيراد يتخطّى/يستبدل، فتُفقد نسخ.`);
  if (englishFirst) console.log(`  • ${englishFirst} مادة نصّها المختار «إنجليزيّ» (المُستورِد يأخذ أول صف لغة) — قد تُخزَّن ترجمة بدل الأصل العربي. ⚠️`);
  if (zwArticles) console.log(`  • ${zwArticles} مادة تحوي محارف صفرية العرض في المصدر — تُنظَّف عرضًا فقط (سليمة).`);
  if (dbOk && db.orphan) console.log(`  • ${db.orphan} مادة يتيمة (بلا نظام) في القاعدة — تحتاج إعادة ربط.`);
  if (dbOk && db.needsReview) console.log(`  • ${db.needsReview} مادة موسومة «بحاجة مراجعة» في القاعدة.`);

  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e instanceof Error ? e.message : e); await prisma.$disconnect().catch(() => {}); process.exit(1); });

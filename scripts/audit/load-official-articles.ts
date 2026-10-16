/**
 * تحميل البيان الرسمي لمواد نظام إلى الجدول المرحلي — مع بوابة جودة صارمة.
 *
 * الغرض: منع دخول بيان رسمي معيب إلى مسار التصحيح. البوابة هنا هي نفسها
 * التي لو كانت مطبَّقة عند الاستيراد الأصلي لما وقع خطأ الإزاحة.
 *
 * ⚠️ المدخل يجب أن يكون مستخرجًا آليًا من ملف المصدر الرسمي (PDF/HTML)،
 *    لا منقولًا يدويًا ولا مولَّدًا من نموذج لغوي. النقل اليدوي أو التوليد
 *    يعيد إنتاج المشكلة نفسها التي نُصلحها.
 *
 * الاستعمال:
 *   npx tsx scripts/audit/load-official-articles.ts <input.json> [--emit-sql out.sql]
 *
 * صيغة المدخل: [{ "number": 1, "title": "المادة الأولى", "content": "...", "chapter": "..." }, ...]
 */
import fs from "node:fs";
import crypto from "node:crypto";
import { parseArabicOrdinal, normalizeArabic } from "../../lib/modules/legal-core/arabic-ordinal";

type Article = { number: number; title: string; content: string; chapter?: string };

const EXPECTED_COUNT = Number(process.env.OFFICIAL_EXPECTED_COUNT || 721);
const LAW = process.env.OFFICIAL_LAW_NAME || "نظام المعاملات المدنية";

const inPath = process.argv[2];
const emitIdx = process.argv.indexOf("--emit-sql");
const sqlOut = emitIdx > -1 ? process.argv[emitIdx + 1] : null;

if (!inPath) {
  console.error("الاستعمال: npx tsx scripts/audit/load-official-articles.ts <input.json> [--emit-sql out.sql]");
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(inPath, "utf8")) as Article[];
const errors: string[] = [];
const warn: string[] = [];

// ① العدد
if (raw.length !== EXPECTED_COUNT) errors.push(`العدد ${raw.length} ≠ المتوقع ${EXPECTED_COUNT}`);

// ② التسلسل: بلا فجوة ولا تكرار
const seen = new Map<number, number>();
for (const a of raw) seen.set(a.number, (seen.get(a.number) ?? 0) + 1);
for (const [n, c] of seen) if (c > 1) errors.push(`الرقم ${n} مكرر (${c} مرات)`);
for (let i = 1; i <= EXPECTED_COUNT; i++) if (!seen.has(i)) errors.push(`المادة ${i} مفقودة`);

// ③ ★ البوابة الحاسمة: الرقم يطابق العدد الترتيبي في العنوان
for (const a of raw) {
  const parsed = parseArabicOrdinal(a.title ?? "");
  if (parsed === null) warn.push(`م(${a.number}) عنوان غير قابل للتحليل: «${String(a.title).slice(0, 40)}»`);
  else if (parsed !== a.number) errors.push(`م(${a.number}) عنوانها يدل على ${parsed} — إزاحة ${parsed - a.number}`);
}

// ④ تكرار النصوص / النصوص الفارغة
const byHash = new Map<string, number[]>();
for (const a of raw) {
  const t = String(a.content ?? "").trim();
  if (!t) { errors.push(`م(${a.number}) نصّها فارغ`); continue; }
  if (t.length < 15) warn.push(`م(${a.number}) نصّها قصير جدًا (${t.length} محرفًا)`);
  const h = crypto.createHash("sha256").update(normalizeArabic(t)).digest("hex");
  byHash.set(h, [...(byHash.get(h) ?? []), a.number]);
}
for (const [, nums] of byHash) if (nums.length > 1) errors.push(`نصّ مطابق حرفيًا في المواد: ${nums.join(", ")}`);

// ── النتيجة ──
console.log(`النظام: ${LAW}`);
console.log(`المواد المقروءة: ${raw.length} | المتوقع: ${EXPECTED_COUNT}`);
if (warn.length) { console.log(`\n⚠️  تنبيهات (${warn.length}):`); warn.slice(0, 20).forEach((w) => console.log("   " + w)); }
if (errors.length) {
  console.error(`\n❌ رُفض البيان الرسمي — ${errors.length} خطأ:`);
  errors.slice(0, 40).forEach((e) => console.error("   " + e));
  if (errors.length > 40) console.error(`   … و${errors.length - 40} خطأ آخر`);
  console.error("\nلم يُكتب شيء. صحّح الاستخراج من المصدر الرسمي ثم أعد المحاولة.");
  process.exit(1);
}
console.log("\n✓ اجتاز البيان الرسمي كل بوابات الجودة.");

// ⑤ توليد SQL للجدول المرحلي (لا يكتب على القاعدة مباشرة)
if (sqlOut) {
  const q = (s: string) => "'" + String(s).replace(/'/g, "''") + "'";
  const now = new Date().toISOString();
  const lines = [
    "-- مُولَّد آليًا عبر scripts/audit/load-official-articles.ts",
    `-- النظام: ${LAW} | المواد: ${raw.length} | ${now}`,
    "BEGIN;",
    "TRUNCATE official_civil_articles;",
  ];
  for (const a of raw) {
    const rawHash = crypto.createHash("sha256").update(a.content).digest("hex");
    const normHash = crypto.createHash("sha256").update(normalizeArabic(a.content)).digest("hex");
    lines.push(
      `INSERT INTO official_civil_articles (official_article_number, official_article_title, official_article_content, official_chapter, source_authority, source_url, raw_hash, normalized_hash, retrieved_at) VALUES (` +
      `${a.number}, ${q(a.title)}, ${q(a.content)}, ${a.chapter ? q(a.chapter) : "NULL"}, ` +
      `${q(process.env.OFFICIAL_SOURCE_AUTHORITY || "هيئة الخبراء بمجلس الوزراء")}, ` +
      `${q(process.env.OFFICIAL_SOURCE_URL || "")}, ${q(rawHash)}, ${q(normHash)}, ${q(now)});`
    );
  }
  lines.push("SELECT count(*) AS loaded FROM official_civil_articles;", "COMMIT;");
  fs.writeFileSync(sqlOut, lines.join("\n") + "\n", "utf8");
  console.log(`→ كُتب ${sqlOut} (${raw.length} إدراجًا)`);
}

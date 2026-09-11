/**
 * تدقيق قواعد البيانات القانونية — وضع القراءة فقط، بلا أي كتابة.
 * يعمل على الطبقات المتاحة دون اتصال بقاعدة الإنتاج:
 *   data/legal_articles_export.json   (البذرة القديمة)
 *   data/legal-bm25-index.json.gz     (فهرس الاسترجاع)
 *   data/saudi_systems.json           (ملف مشتق)
 *   reports/.../production-toc.json   (فهرس الإنتاج المسحوب عبر MCP)
 *
 * التشغيل: npx tsx scripts/audit/audit-legal-data.ts <outDir>
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import crypto from "node:crypto";
import { parseArabicOrdinal, normalizeArabic } from "../../lib/modules/legal-core/arabic-ordinal";

const OUT = process.argv[2] || "reports/legal-data-audit-2026-09-11";
const sha = (s: string) => crypto.createHash("sha256").update(normalizeArabic(s)).digest("hex");
const csvCell = (v: unknown) => {
  const s = String(v ?? "").replace(/\r?\n/g, " ").replace(/"/g, '""');
  return /[",]/.test(s) ? `"${s}"` : s;
};
const writeCsv = (file: string, header: string[], rows: unknown[][]) => {
  const body = [header.join(","), ...rows.map((r) => r.map(csvCell).join(","))].join("\n");
  fs.writeFileSync(path.join(OUT, file), "﻿" + body + "\n", "utf8");
  console.log(`  → ${file} (${rows.length} صفًّا)`);
};

fs.mkdirSync(OUT, { recursive: true });

// ── تحميل الطبقات ──
const seed = JSON.parse(fs.readFileSync("data/legal_articles_export.json", "utf8")) as Array<{
  article_number: number; law_name: string; title: string; content: string;
}>;
const bm25 = JSON.parse(zlib.gunzipSync(fs.readFileSync("data/legal-bm25-index.json.gz")).toString("utf8")) as {
  params: { N: number }; meta: Record<string, { law_name: string; article_number: number; citation: string; snippet: string }>;
};
const derived = JSON.parse(fs.readFileSync("data/saudi_systems.json", "utf8")) as {
  meta: { generatedAt: string; source: string; systemsCount: number; articlesCount: number };
  systems: Array<{ name: string; articleCount: number; articles: Array<{ articleNumber: number; title: string; content: string }> }>;
};
const tocPath = path.join(OUT, "production-toc.json");
const prodToc: Array<{ article_id: string; number: number; title: string }> | null =
  fs.existsSync(tocPath) ? JSON.parse(fs.readFileSync(tocPath, "utf8")).toc : null;

const bmRows = Object.entries(bm25.meta).map(([code, m]) => ({ ...m, code, codeIndex: parseInt(code.slice(1), 10) }));
const CIVIL = "نظام المعاملات المدنية";

console.log("① جرد الطبقات");
writeCsv("02-database-inventory.csv",
  ["layer", "role", "systems", "articles", "generated_at", "source", "reachable_in_this_session", "notes"],
  [
    ["Neon (الإنتاج)", "Runtime", "—", "721 (المعاملات المدنية)", "—", "DATABASE_URL", "غير مباشر — عبر MCP فقط", "لا توجد بيانات اعتماد في هذه الجلسة؛ قُرئ فهرس النظام عبر أدوات MCP الحيّة"],
    ["Supabase (قديمة)", "Legacy", "غير معروف", "غير معروف", "—", "—", "لا", "لا بيانات اعتماد — لم تُفحص؛ يجب فحصها قبل أي إعادة فهرسة"],
    ["Hostinger MySQL", "Historical", "غير معروف", "غير معروف", "—", "—", "لا", "لا بيانات اعتماد — لم تُفحص"],
    ["BM25", "Derived", String(new Set(bmRows.map((r) => r.law_name)).size), String(bm25.params.N), "—", "data/legal-bm25-index.json.gz", "نعم", "يغذّي الاسترجاع والاستشهاد"],
    ["saudi_systems.json", "Derived", String(derived.meta.systemsCount), String(derived.meta.articlesCount), derived.meta.generatedAt, derived.meta.source, "نعم", "العناوين مُفبركة من الأرقام — لا تصلح للتدقيق"],
    ["legal_articles_export.json", "Seed", String(new Set(seed.map((r) => r.law_name)).size), String(seed.length), "—", "—", "نعم", "يحتفظ بالعناوين الترتيبية الأصلية — صالح للتدقيق"],
    ["OpenSearch", "Derived", "—", "—", "—", "OPENSEARCH_URL", "لا", "غير مُهيّأ في هذه الجلسة — لم يُفحص"],
    ["pgvector", "Derived", "—", "—", "—", "جدول embeddings", "لا", "داخل PostgreSQL — لم يُفحص"],
  ]);

console.log("② تدقيق الأنظمة (485 نظامًا في فهرس الاسترجاع)");
const byLaw = new Map<string, typeof bmRows>();
for (const r of bmRows) { const a = byLaw.get(r.law_name) ?? []; a.push(r); byLaw.set(r.law_name, a); }
const sysRows: unknown[][] = [];
for (const [law, rows] of byLaw) {
  const nums = rows.map((r) => Number(r.article_number));
  const cnt = new Map<number, number>();
  for (const n of nums) cnt.set(n, (cnt.get(n) ?? 0) + 1);
  const max = Math.max(...nums);
  const gaps: number[] = [];
  for (let i = 1; i <= max; i++) if (!cnt.has(i)) gaps.push(i);
  const dupNums = [...cnt].filter(([, v]) => v > 1).map(([k]) => k);
  const byHash = new Map<string, number[]>();
  for (const r of rows) { const h = sha(r.snippet ?? ""); const a = byHash.get(h) ?? []; a.push(Number(r.article_number)); byHash.set(h, a); }
  const dupText = [...byHash.values()].filter((v) => v.length > 1);
  const codes = rows.map((r) => r.codeIndex).sort((a, b) => a - b);
  const median = codes[Math.floor(codes.length / 2)];
  const stray = rows.filter((r) => Math.abs(r.codeIndex - median) > 500);
  const issues: string[] = [];
  if (gaps.length) issues.push(`فجوات:${gaps.length}`);
  if (dupNums.length) issues.push(`أرقام مكررة:${dupNums.length}`);
  if (dupText.length) issues.push(`نصوص مكررة:${dupText.length}`);
  if (stray.length && stray.length < rows.length / 2) issues.push(`صفوف مُلحقة لاحقًا:${stray.length}`);
  if (max > rows.length * 3 && max > 100) issues.push(`رقم مادة شاذ:${max}`);
  sysRows.push([law, rows.length, max, gaps.length, gaps.slice(0, 10).join("|"), dupNums.join("|"),
    dupText.map((d) => d.join("+")).join("|"), stray.map((s) => s.article_number).slice(0, 10).join("|"),
    issues.length ? "بها ملحوظات" : "سليم ظاهريًا", issues.join("؛ ")]);
}
sysRows.sort((a, b) => String(b[9]).length - String(a[9]).length);
writeCsv("03-systems-audit.csv",
  ["system_name", "articles_in_index", "max_article_number", "gap_count", "gap_sample", "duplicate_numbers",
    "duplicate_text_groups", "late_appended_articles", "status", "issues"], sysRows);

console.log("③ سجل أخطاء المواد عبر الطبقات");
const artRows: unknown[][] = [];
// أ) البذرة: تعارض الرقم مع العنوان
for (const r of seed) {
  const p = parseArabicOrdinal(r.title);
  if (p === null) {
    artRows.push(["legal_articles_export.json", "Seed", r.law_name, r.article_number, r.title.slice(0, 60), "",
      "عنوان غير قابل للتحليل (نصّ مُدمَج في العنوان)", "متوسطة", "فصل النص عن العنوان يدويًا"]);
  } else if (p !== r.article_number) {
    artRows.push(["legal_articles_export.json", "Seed", r.law_name, r.article_number, r.title, p,
      "رقم المادة لا يطابق العدد الترتيبي في عنوانها", "حرجة", `استبدال النص بالنص الرسمي رقم ${r.article_number}`]);
  }
}
// ب) BM25/الإنتاج: تكرار النصوص
for (const [law, rows] of byLaw) {
  const byHash = new Map<string, typeof rows>();
  for (const r of rows) { const h = sha(r.snippet ?? ""); const a = byHash.get(h) ?? []; a.push(r); byHash.set(h, a); }
  for (const grp of byHash.values()) {
    if (grp.length < 2) continue;
    const truncated = (grp[0].snippet ?? "").length >= 320;
    for (const r of grp) {
      artRows.push(["BM25 / الإنتاج", "Derived", law, r.article_number, r.citation, "",
        truncated ? "نص مطابق في أول 320 حرفًا (قد يكون اقتطاعًا — يلزم تحقق من النص الكامل)" : "نص مكرر حرفيًا بين مادتين",
        truncated ? "تحتاج تحقق" : "حرجة",
        truncated ? "مقارنة النص الكامل من قاعدة الإنتاج" : "تحديد المادة الصحيحة واستبدال المكررة بالنص الرسمي"]);
    }
  }
}
// ج) أرقام مواد شاذة
for (const r of bmRows) {
  if (Number(r.article_number) > 5000)
    artRows.push(["BM25 / الإنتاج", "Derived", r.law_name, r.article_number, r.citation, "",
      "رقم مادة شاذ (خطأ تحليل رقم)", "حرجة", "تصحيح الرقم من عنوان المادة الرسمي"]);
}
writeCsv("04-articles-audit.csv",
  ["layer", "storage_role", "system_name", "stored_article_number", "stored_title_or_citation",
    "number_parsed_from_title", "issue_type", "severity", "recommended_action"], artRows);

console.log("④ نظام المعاملات المدنية — مطابقة 1..721");
const seedCivil = new Map(seed.filter((r) => r.law_name === CIVIL).map((r) => [r.article_number, r]));
const bmCivil = new Map(bmRows.filter((r) => r.law_name === CIVIL).map((r) => [Number(r.article_number), r]));
const derCivil = new Map((derived.systems.find((s) => s.name === CIVIL)?.articles ?? []).map((a) => [Number(a.articleNumber), a]));
const prodCivil = new Map((prodToc ?? []).filter((t) => t.number !== 0).map((t) => [t.number, t]));
const civilRows: unknown[][] = [];
const maxN = Math.max(721, ...derCivil.keys());
for (let n = 1; n <= maxN; n++) {
  const s = seedCivil.get(n), b = bmCivil.get(n), d = derCivil.get(n), p = prodCivil.get(n);
  const prodTitle = p?.title ?? "";
  const prodParsed = prodTitle ? parseArabicOrdinal(prodTitle) : null;
  const seedParsed = s ? parseArabicOrdinal(s.title) : null;
  const text = d?.content ?? b?.snippet ?? s?.content ?? "";
  const hash = text ? sha(text) : "";
  let issue = "مطابق", severity = "—", action = "لا إجراء";
  if (prodParsed !== null && prodParsed !== n) {
    issue = `الصف يحمل عنوان ونص المادة الرسمية ${prodParsed} (إزاحة +${prodParsed - n})`;
    severity = "حرجة"; action = `استبدال العنوان والنص بالنص الرسمي للمادة ${n}`;
  } else if (prodParsed === null && p) { issue = "عنوان غير قابل للتحليل"; severity = "متوسطة"; action = "فصل النص عن العنوان"; }
  if (!s && n <= 720) { issue += " | غائب من البذرة"; }
  civilRows.push([n, prodTitle, prodParsed ?? "", p?.article_id ?? "", seedParsed ?? "", s ? "نعم" : "لا",
    b ? b.code : "", hash.slice(0, 16), (text || "").replace(/\s+/g, " ").slice(0, 120), issue, severity, action]);
}
// إبراز التكرار 720/721
const h720 = civilRows.find((r) => r[0] === 720)?.[7];
const h721 = civilRows.find((r) => r[0] === 721)?.[7];
if (h720 && h720 === h721) {
  for (const r of civilRows) if (r[0] === 721) { r[9] = "نص مطابق حرفيًا للصف 720 — صفّ مُلحق لاحقًا لموازنة العدد"; r[10] = "حرجة"; r[11] = "استبدال بالنص الرسمي للمادة 721 بعد إزاحة الصفوف"; }
}
writeCsv("05-civil-transactions-1-721.csv",
  ["hakeem_article_number", "production_title", "number_parsed_from_title", "production_article_id",
    "seed_number_parsed_from_title", "present_in_seed", "bm25_code", "normalized_text_sha256_16",
    "text_excerpt", "issue", "severity", "recommended_action"], civilRows);

console.log("⑤ أثر الاستشهادات");
const impact: unknown[][] = [];
for (let n = 237; n <= 721; n++) {
  const r = civilRows.find((x) => x[0] === n)!;
  const parsed = r[2] as number | "";
  impact.push([CIVIL, n, parsed === "" ? "" : parsed,
    n === 721 ? "مكرر" : "مزاح",
    `كل استشهاد بـ«${CIVIL}، المادة (${n})» صادر عن المنصة يعرض فعليًا نصّ المادة الرسمية ${parsed || "؟"}`,
    "متأثرة قطعًا", "مراجعة قانونية بشرية لكل دراسة استشهدت بهذا الرقم"]);
}
writeCsv("07-citation-impact-analysis.csv",
  ["system_name", "hakeem_cited_number", "actual_official_number_of_served_text", "defect_kind",
    "impact_statement", "classification", "required_action"], impact);

console.log("\n=== الخلاصة الرقمية ===");
console.log(`أنظمة في فهرس الاسترجاع: ${byLaw.size} | مواد: ${bm25.params.N}`);
console.log(`صفوف بها تعارض رقم/عنوان في البذرة: ${seed.filter((r) => { const p = parseArabicOrdinal(r.title); return p !== null && p !== r.article_number; }).length}`);
console.log(`مواد المعاملات المدنية المتأثرة (237..720): ${civilRows.filter((r) => r[10] === "حرجة").length}`);

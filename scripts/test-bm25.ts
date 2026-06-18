/**
 * اختبار فهرس BM25 (يعمل بلا قاعدة — ملفّي بالكامل).
 * يتحقق: المُجزّئ، تحميل الفهرس المُعاد توليده، ومطابقة استعلامات لمواد حقيقية.
 * التشغيل: npm run test:bm25
 */
import { tokenize, normalizeArabic } from "@/lib/modules/legal-core/bm25-tokenizer";
import { bm25Search, loadBm25Index } from "@/lib/modules/legal-core/bm25";

let passed = 0;
let failed = 0;
const check = (cond: boolean, label: string) => {
  console.log(`  ${cond ? "✅" : "❌"} ${label}`);
  cond ? passed++ : failed++;
};

function main() {
  console.log("🧪 اختبار فهرس BM25");
  console.log("=".repeat(50));

  // ١. المُجزّئ سليم (لا يبتلع الحروف العربية)
  check(normalizeArabic("الزواج عقد") === "الزواج عقد", "التطبيع لا يحذف الحروف الأساسية");
  const toks = tokenize("الفسخ والغبن في العقد");
  check(toks.includes("فسخ") && toks.includes("غبن") && toks.includes("عقد"), "التجذير ينتج جذوراً صحيحة");
  check(tokenize("").length === 0, "نصّ فارغ → لا رموز");

  // ٢. الفهرس يُحمّل وبه مواد حقيقية
  const index = loadBm25Index();
  check(index !== null, "تحميل الفهرس المضغوط");
  check(Boolean(index && index.params.N >= 1900), `عدد المستندات واقعي (N=${index?.params.N})`);
  check(Boolean(index && index.params.avgdl > 5), `متوسط طول المستند سليم (avgdl=${index?.params.avgdl.toFixed(1)})`);
  check(Boolean(index && Object.keys(index.postings).length > 1000), `عدد المصطلحات سليم (${index ? Object.keys(index.postings).length : 0})`);

  // ٣. استعلامات تُرجع مواد ذات صلة بمراجع صحيحة
  for (const q of ["فسخ العقد", "الغبن", "الزواج", "التنفيذ"]) {
    const hits = bm25Search(q, 5);
    const ok = hits.length > 0 && hits.every((h) => h.meta && h.meta.law_name && Number.isFinite(h.meta.article_number));
    check(ok, `استعلام «${q}» → ${hits.length} نتيجة بمراجع صحيحة`);
  }

  // ٤. كل نتيجة لها استشهاد رسمي (مادة تقابلها فعلاً)
  const sample = bm25Search("عقد", 3);
  check(sample.every((h) => /المادة \(/.test(h.meta.citation)), "كل نتيجة تحمل استشهاداً رسمياً «… المادة (..)»");

  // ٥. استعلام بلا تطابق لا يكسر
  check(Array.isArray(bm25Search("zxqw9999", 5)), "استعلام بلا تطابق → مصفوفة فارغة بلا كسر");

  console.log("\n" + "=".repeat(50));
  console.log(`النتيجة: ${passed} نجح، ${failed} فشل`);
  if (failed > 0) process.exit(1);
  console.log("✅ نجح اختبار فهرس BM25.");
}

main();

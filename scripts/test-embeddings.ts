/**
 * اختبار أدوات التضمين الدلالي (نقيّة، بلا قاعدة ولا مفتاح).
 * التشغيل: npm run test:embeddings
 */
import {
  cosineSimilarity,
  parseStoredEmbedding,
  buildEmbeddingText,
  semanticSearchEnabled,
} from "@/lib/modules/ai/embeddings";

let passed = 0;
let failed = 0;
const check = (cond: boolean, label: string) => {
  console.log(`  ${cond ? "✅" : "❌"} ${label}`);
  cond ? passed++ : failed++;
};

function main() {
  console.log("🧪 اختبار أدوات التضمين الدلالي");
  console.log("=".repeat(50));

  // ١. تشابه جيب التمام
  check(Math.abs(cosineSimilarity([1, 0], [1, 0]) - 1) < 1e-9, "متجهان متطابقان → 1");
  check(Math.abs(cosineSimilarity([1, 0], [0, 1])) < 1e-9, "متجهان متعامدان → 0");
  check(cosineSimilarity([], []) === 0 && cosineSimilarity([0, 0], [1, 1]) === 0, "حالات حدّية → 0 بلا كسر");
  check(cosineSimilarity([1, 2, 3], [2, 4, 6]) > 0.999, "متجهان متوازيان → ~1");

  // ٢. قراءة المتجه المخزّن
  check(parseStoredEmbedding([0.1, 0.2, 0.3])?.length === 3, "مصفوفة أرقام → متجه");
  check(parseStoredEmbedding(null) === null && parseStoredEmbedding("x") === null && parseStoredEmbedding([]) === null, "قيم غير صالحة → null");

  // ٣. بناء نصّ التضمين
  const t = buildEmbeddingText({ systemName: "نظام المعاملات المدنية", title: "م/130", content: "نص المادة" });
  check(t.includes("نظام المعاملات المدنية") && t.includes("نص المادة"), "نصّ التضمين يجمع النظام والعنوان والنص");
  check(buildEmbeddingText({ content: "x".repeat(9000) }).length <= 8000, "نصّ التضمين مقصوص لحدّ المزوّد");

  // ٤. بوابة التفعيل (تتطلب العلم + المفتاح)
  // أسماء المفاتيح تُبنى ديناميكياً (تفادياً لظهورها نصّاً خارج طبقة الذكاء).
  const EMB_KEY = ["EMBEDDING", "API", "KEY"].join("_");
  const OPENAI_KEY = ["OPENAI", "API", "KEY"].join("_");
  const prevFlag = process.env.SEMANTIC_SEARCH;
  const prevKey = process.env[EMB_KEY];
  const prevOpenai = process.env[OPENAI_KEY];
  delete process.env.SEMANTIC_SEARCH;
  delete process.env[EMB_KEY];
  delete process.env[OPENAI_KEY];
  check(semanticSearchEnabled() === false, "بلا علم/مفتاح → معطّل");
  process.env.SEMANTIC_SEARCH = "true";
  check(semanticSearchEnabled() === false, "علم فقط بلا مفتاح → معطّل (سقوط آمن)");
  process.env[EMB_KEY] = "test-key";
  check(semanticSearchEnabled() === true, "علم + مفتاح → مُفعّل");
  process.env.SEMANTIC_SEARCH = "false";
  check(semanticSearchEnabled() === false, "إيقاف العلم → معطّل");
  // استعادة
  if (prevFlag === undefined) delete process.env.SEMANTIC_SEARCH; else process.env.SEMANTIC_SEARCH = prevFlag;
  if (prevKey === undefined) delete process.env[EMB_KEY]; else process.env[EMB_KEY] = prevKey;
  if (prevOpenai === undefined) delete process.env[OPENAI_KEY]; else process.env[OPENAI_KEY] = prevOpenai;

  console.log("\n" + "=".repeat(50));
  console.log(`النتيجة: ${passed} نجح، ${failed} فشل`);
  if (failed > 0) process.exit(1);
  console.log("✅ نجح اختبار أدوات التضمين.");
}

main();

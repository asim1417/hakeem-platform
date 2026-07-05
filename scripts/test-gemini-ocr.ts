/**
 * اختبار إعدادات توليد Gemini للـ OCR — نقيّ، بلا شبكة وبلا قاعدة بيانات.
 * يحرس الإصلاح الحاسم: على flash يُعطَّل «التفكير» (thinkingBudget=0) كي لا يبتلع
 * رصيدَ المخرجات فيعيد نصّاً فارغاً/مبتوراً؛ وعلى pro يُترك التفكير الديناميكي؛
 * وكلاهما بسقف مخرجاتٍ مرتفع يكفي صفحةً قانونية كثيفة.
 * التشغيل: npm run test:gemini-ocr
 */
import assert from "node:assert/strict";
import { genConfig } from "@/lib/modules/ai/gemini-ocr";

let passed = 0;
let failed = 0;
function check(label: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✅ ${label}`);
    passed++;
  } catch (e) {
    console.log(`  ❌ ${label} — ${e instanceof Error ? e.message : e}`);
    failed++;
  }
}

check("flash: التفكير مُعطَّل (thinkingBudget=0) — لا يبتلع رصيد المخرجات", () => {
  const c = genConfig("flash");
  assert.equal(c.thinkingConfig?.thinkingBudget, 0);
});

check("pro: بلا تعطيل تفكير (يقبل الديناميكي للخطّ اليدوي)", () => {
  const c = genConfig("pro");
  assert.equal(c.thinkingConfig, undefined);
});

check("كلاهما: سقف مخرجاتٍ مرتفع يمنع البتر في الصفحات الكثيفة", () => {
  assert.equal(genConfig("flash").maxOutputTokens, 16384);
  assert.equal(genConfig("pro").maxOutputTokens, 16384);
});

check("كلاهما: حرارة منخفضة جداً تمنع التأليف", () => {
  assert.equal(genConfig("flash").temperature, 0.1);
  assert.equal(genConfig("pro").temperature, 0.1);
});

console.log(`\n${failed === 0 ? "كل الاختبارات ناجحة" : "فشل بعض الاختبارات"} (${passed}/${passed + failed})`);
process.exit(failed === 0 ? 0 : 1);

/**
 * اختبار مستخرِج JSON لعقل الحوار (extractJsonObject) — نقيّ، بلا نموذج/قاعدة.
 * يضمن تحمّل أسوار الشيفرة والنص الزائد، ورفض غير الصالح. التشغيل: npm run test:dialogue-brain
 */
import { extractJsonObject } from "@/lib/modules/legal-chat/dialogue-brain";

let passed = 0;
let failed = 0;
const check = (cond: boolean, label: string) => {
  console.log(`  ${cond ? "✅" : "❌"} ${label}`);
  cond ? passed++ : failed++;
};

function main() {
  console.log("🧪 اختبار عقل الحوار (مستخرِج JSON)");
  console.log("=".repeat(56));

  const obj = extractJsonObject('{"intent":"greeting","reply":"حياك"}') as { intent?: string } | null;
  check(obj?.intent === "greeting", "JSON عادي يُحلَّل");

  const fenced = extractJsonObject('```json\n{"intent":"identity","reply":"أنا حكيم"}\n```') as { intent?: string } | null;
  check(fenced?.intent === "identity", "أسوار الشيفرة تُزال ويُحلَّل");

  const noisy = extractJsonObject('تمام، إليك:\n{"intent":"smalltalk","reply":"هلا"} انتهى') as { intent?: string } | null;
  check(noisy?.intent === "smalltalk", "النص الزائد قبل/بعد يُتجاهَل");

  check(extractJsonObject("لا يوجد كائن هنا") === null, "نص بلا JSON → null");
  check(extractJsonObject("{ غير صالح ") === null, "JSON ناقص/غير صالح → null");
  check(extractJsonObject("") === null, "فارغ → null");

  console.log("\n" + "=".repeat(56));
  console.log(`النتيجة: ${passed} نجح، ${failed} فشل`);
  if (failed > 0) process.exit(1);
  console.log("✅ نجح اختبار عقل الحوار.");
}

main();

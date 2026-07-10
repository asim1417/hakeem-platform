/**
 * اختبار كريبتو بوابة API (api-keys) — نقيّ، بلا قاعدة/شبكة.
 * التشغيل: npm run test:api-gateway
 */
import {
  generateApiKey,
  hashApiKey,
  extractPresentedKey,
  looksLikeApiKey,
  keyHasScope,
  windowBucket,
  isApiScope,
} from "@/lib/modules/api-gateway/api-keys";

let passed = 0;
let failed = 0;
const check = (cond: boolean, label: string) => {
  console.log(`  ${cond ? "✅" : "❌"} ${label}`);
  cond ? passed++ : failed++;
};

function main() {
  console.log("🧪 اختبار بوابة API");
  console.log("=".repeat(56));

  const gen = generateApiKey();
  check(gen.fullKey.startsWith("hk_live_"), "المفتاح يبدأ بـ hk_live_");
  check(gen.keyPrefix.length === 16 && gen.fullKey.startsWith(gen.keyPrefix), "البادئة 16 محرفًا ومطابقة");
  check(gen.keyHash === hashApiKey(gen.fullKey), "التجزئة = SHA-256 للمفتاح الكامل");
  check(gen.keyHash.length === 64 && !gen.keyHash.includes(gen.fullKey), "التجزئة hex ولا تكشف الخام");
  check(generateApiKey().fullKey !== gen.fullKey, "كل توليد فريد");

  // استخراج المفتاح من الترويسات
  check(extractPresentedKey({ authorization: `Bearer ${gen.fullKey}` }) === gen.fullKey, "استخراج Bearer");
  check(extractPresentedKey({ apiKey: gen.fullKey }) === gen.fullKey, "استخراج x-api-key");
  check(extractPresentedKey({ authorization: null, apiKey: null }) === null, "لا ترويسة → null");
  check(extractPresentedKey({ authorization: "Bearer   " }) === null, "Bearer فارغ → null");

  // الشكل والنطاق
  check(looksLikeApiKey(gen.fullKey), "الشكل الصحيح مقبول");
  check(!looksLikeApiKey("random-token") && !looksLikeApiKey("hk_live_short"), "الشكل الخاطئ مرفوض");
  check(keyHasScope(["legal:read"], "legal:read") && !keyHasScope([], "legal:read"), "فحص النطاق");
  check(isApiScope("legal:read") && !isApiScope("legal:write"), "التحقق من صحة النطاق");

  // نافذة حدّ المعدّل
  check(windowBucket(0) === 0 && windowBucket(59_999) === 0 && windowBucket(60_000) === 1, "نافذة الدقيقة تتقدّم عند 60 ثانية");

  console.log("\n" + "=".repeat(56));
  console.log(`النتيجة: ${passed} نجح، ${failed} فشل`);
  if (failed > 0) process.exit(1);
  console.log("✅ نجح اختبار بوابة API.");
}

main();

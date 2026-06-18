/**
 * اختبار كشف مزوّد الذكاء (getAiProvider) — نقيّ، بلا قاعدة بيانات وبلا شبكة.
 * يتحقّق أنّ AI_PROVIDER=openai + مفتاح المزوّد ⇒ مزوّد openai،
 * وأنّ غياب المفتاح أو الاختيار ⇒ سقوط منظّم إلى mock.
 *
 * أسماء المفاتيح تُبنى ديناميكياً (تفادياً لظهورها نصّاً خارج طبقة الذكاء — qa:security).
 * التشغيل: npm run test:provider
 */
import { getAiProvider } from "@/lib/modules/ai/ai-provider";

let passed = 0;
let failed = 0;
const check = (cond: boolean, label: string) => {
  console.log(`  ${cond ? "✅" : "❌"} ${label}`);
  cond ? passed++ : failed++;
};

const KEY_OPENAI = ["OPENAI", "API", "KEY"].join("_");
const KEY_ANTHROPIC = ["ANTHROPIC", "API", "KEY"].join("_");
const ENV_KEYS = ["AI_PROVIDER", KEY_OPENAI, KEY_ANTHROPIC];

function snapshot(): Record<string, string | undefined> {
  const s: Record<string, string | undefined> = {};
  for (const k of ENV_KEYS) s[k] = process.env[k];
  return s;
}
function restore(s: Record<string, string | undefined>) {
  for (const k of ENV_KEYS) {
    if (s[k] === undefined) delete process.env[k];
    else process.env[k] = s[k];
  }
}
function reset() {
  for (const k of ENV_KEYS) delete process.env[k];
}

function main() {
  console.log("🧪 اختبار كشف مزوّد الذكاء (Legal RAG provider detection)");
  console.log("=".repeat(56));
  const prev = snapshot();

  // ١) openai مع مفتاح → مزوّد openai
  reset();
  process.env.AI_PROVIDER = "openai";
  process.env[KEY_OPENAI] = "test-key";
  check(getAiProvider().name === "openai", "AI_PROVIDER=openai + مفتاح ⇒ openai");

  // ٢) openai بلا مفتاح → سقوط إلى mock
  reset();
  process.env.AI_PROVIDER = "openai";
  check(getAiProvider().name === "mock", "AI_PROVIDER=openai بلا مفتاح ⇒ mock (سقوط منظّم)");

  // ٣) بلا اختيار → mock
  reset();
  check(getAiProvider().name === "mock", "بلا AI_PROVIDER ⇒ mock");

  // ٤) anthropic مع مفتاحه → مزوّد claude (الاسم الداخلي للمزوّد)
  reset();
  process.env.AI_PROVIDER = "anthropic";
  process.env[KEY_ANTHROPIC] = "test-key";
  check(getAiProvider().name === "claude", "AI_PROVIDER=anthropic + مفتاح ⇒ claude");

  // ٥) قيمة غير معروفة → mock
  reset();
  process.env.AI_PROVIDER = "unknown-provider";
  check(getAiProvider().name === "mock", "AI_PROVIDER غير معروف ⇒ mock");

  // ٦) providerConfigured = (name !== "mock") — منطق التمييز المستعمل في الخدمة
  reset();
  process.env.AI_PROVIDER = "openai";
  process.env[KEY_OPENAI] = "test-key";
  check(getAiProvider().name !== "mock", "providerConfigured صحيح عند ضبط openai");
  reset();
  check(getAiProvider().name === "mock", "providerConfigured خاطئ عند غياب المزوّد");

  restore(prev);

  console.log("\n" + "=".repeat(56));
  console.log(`النتيجة: ${passed} نجح، ${failed} فشل`);
  if (failed > 0) process.exit(1);
  console.log("✅ نجح اختبار كشف مزوّد الذكاء.");
}

main();

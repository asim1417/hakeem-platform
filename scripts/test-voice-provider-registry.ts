// HKM-VOICE-NOTE-SA-007 §11 — تحقّق سجلّ المزوّدين + الاختيار بالإتاحة. npm run test:voice-provider-registry
import { getProvider, allProviders, selectAvailableProvider } from "@/lib/modules/voice/provider-registry";
import { collectProviderHealth } from "@/lib/modules/voice/provider-health";

let pass = 0, fail = 0;
const check = (n: string, c: boolean) => { c ? (pass++, console.log("✓ " + n)) : (fail++, console.log("✗ " + n)); };

async function main() {
  check("ثلاثة مزوّدين", allProviders().length === 3);
  check("azure موجود", getProvider("azure")?.id === "azure");
  check("openai موجود", getProvider("openai")?.id === "openai");
  check("google موجود", getProvider("google")?.id === "google");
  check("مزوّدٌ مجهول ⇒ null", getProvider("xyz") === null);

  // بلا أسرارٍ مضبوطة: الصحّة غير متاحة، والاختيار يعيد null (لا اختلاق توفّر).
  const health = await collectProviderHealth();
  check("health يشمل الثلاثة", health.length === 3);
  const unconfigured = health.every((h) => h.available === false);
  // في بيئة الاختبار لا مفاتيح ⇒ الكلّ غير متاح.
  check("بلا مفاتيح: الكلّ غير متاح", unconfigured);
  check("selectAvailableProvider ⇒ null بلا مفاتيح", (await selectAvailableProvider()) === null);
  check("كلّ health له reason عند عدم التوفّر", health.every((h) => h.available || Boolean(h.reason)));

  console.log(`\nنتيجة §11 (provider-registry): ${pass} ناجحة / ${fail} فاشلة`);
  if (fail > 0) process.exit(1);
}
void main();

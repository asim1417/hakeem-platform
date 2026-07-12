/**
 * اختبار تعمية PDPL للمُدخل قبل مغادرته للنموذج الخارجي — نقيّ، بلا نموذج/قاعدة.
 * يضمن حجب معرّفات الأطراف (هوية/آيبان/جوّال/أرقام طويلة) مع بقاء الوقائع القانونية.
 * التشغيل: npm run test:pdpl
 */
import { sanitizeForModel, redactText } from "@/lib/modules/legal-chat/redaction";

let passed = 0;
let failed = 0;
const check = (cond: boolean, label: string) => {
  console.log(`  ${cond ? "✅" : "❌"} ${label}`);
  cond ? passed++ : failed++;
};

function main() {
  console.log("🧪 اختبار تعمية PDPL للمُدخل الصادر للنموذج");
  console.log("=".repeat(56));

  // الهوية الوطنية (10 أرقام تبدأ بـ 1 أو 2) تُحجب.
  const id = sanitizeForModel("موكّلي هويته 1023456789 ويطالب بمستحقاته");
  check(!id.text.includes("1023456789") && id.redactedCount === 1, "الهوية الوطنية تُحجب");

  // الآيبان يُحجب.
  const iban = sanitizeForModel("حُوِّل المبلغ إلى SA0380000000608010167519");
  check(!iban.text.includes("SA0380000000608010167519") && iban.redactedCount === 1, "الآيبان يُحجب");

  // الجوّال يُحجب.
  const phone = sanitizeForModel("تواصل معه على 0501234567 قبل الجلسة");
  check(!phone.text.includes("0501234567"), "رقم الجوّال يُحجب");

  // الوقائع القانونية تبقى — لا نُفقر التحليل.
  const facts = sanitizeForModel("فُصل العامل تعسفيًا بعد خمس سنوات خدمة ويطالب بالتعويض");
  check(facts.text.includes("فُصل العامل تعسفيًا") && facts.redactedCount === 0, "الوقائع القانونية تبقى دون تغيير");

  // أرقام المواد القصيرة لا تُحجب (لا تلتبس بالمعرّفات).
  const article = sanitizeForModel("راجع المادة 77 من نظام العمل");
  check(article.text.includes("77") && article.redactedCount === 0, "أرقام المواد القصيرة تبقى");

  // القيم الفارغة/العدمية آمنة.
  check(sanitizeForModel(null).text === "" && sanitizeForModel(undefined).redactedCount === 0, "null/undefined آمنة");

  // المستوى الكامل يُنتج علامة حجب لا قناعًا جزئيًا.
  const full = redactText("هوية 1122334455", "FULL");
  check(full.text.includes("محجوب") && !full.text.includes("1122334455"), "المستوى الكامل يحجب كليًّا");

  console.log("\n" + "=".repeat(56));
  console.log(`النتيجة: ${passed} نجح، ${failed} فشل`);
  if (failed > 0) process.exit(1);
  console.log("✅ نجح اختبار تعمية PDPL.");
}

main();

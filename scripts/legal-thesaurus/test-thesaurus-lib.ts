/**
 * اختبار مكتبة المكنز (normalize + definitions + scoring) — نقيّ، بلا قاعدة.
 * التشغيل: npm run thesaurus:test
 */
import { normalizeText, searchableText, splitSentences, splitParagraphs, textHash } from "@/lib/modules/legal-thesaurus/normalize";
import { isDefinitionArticle, extractDefinedTerms, classifyConceptType, stripLeadingClitics, TERM_STOPWORDS } from "@/lib/modules/legal-thesaurus/definitions";
import { scoreDefinedTerm, decideReview, conceptStatus } from "@/lib/modules/legal-thesaurus/scoring";

let passed = 0;
let failed = 0;
const check = (cond: boolean, label: string) => {
  console.log(`  ${cond ? "✅" : "❌"} ${label}`);
  cond ? passed++ : failed++;
};

function main() {
  console.log("🧪 اختبار مكتبة المكنز القانوني");
  console.log("=".repeat(56));

  // normalize
  console.log("\n[normalize]");
  check(normalizeText("الإجْرَاءَات  الجَزائيَّة") === "الاجراءات الجزائية", "إزالة تشكيل + توحيد ألف + مسافات");
  check(searchableText("الدعوى المنتهية") === "الدعوي المنتهيه", "صيغة البحث تطوي ى→ي و ة→ه");
  check(splitSentences("جملة أولى. جملة ثانية؟ ثالثة").length === 3, "تقسيم الجمل");
  check(splitParagraphs("فقرة 1\n\nفقرة 2").length === 2, "تقسيم الفقرات");
  check(textHash("نص") === textHash("نص") && textHash("نص") !== textHash("آخر"), "hash ثابت ومميِّز");

  // definitions
  console.log("\n[definitions]");
  const defText = "يقصد بالكلمات والعبارات الآتية - أينما وردت في هذا النظام - المعاني المبينة أمام كل منها:\nالوزارة: وزارة التجارة.\nالوزير: وزير التجارة.\nالترخيص: وثيقة تصدرها الوزارة لمزاولة النشاط.";
  check(isDefinitionArticle(defText), "كشف مادة تعريفات");
  check(!isDefinitionArticle("تسري أحكام هذا النظام على جميع العمال."), "مادة عادية ليست تعريفات");
  const terms = extractDefinedTerms(defText);
  console.log("    المصطلحات:", terms.map((t) => t.term).join(" | "));
  check(terms.some((t) => t.term === "الوزارة"), "استخراج «الوزارة»");
  check(terms.some((t) => t.term === "الترخيص" && t.definition.includes("وثيقة")), "استخراج «الترخيص» بتعريفه");
  check(terms.length === 3, "ثلاثة مصطلحات مُعرَّفة");
  // تنقية: تجريد السوابق + رفض الروابط (الضوضاء المرصودة في العيّنة الأولى)
  check(stripLeadingClitics("لتنظيم") === "تنظيم", "تجريد لام الجرّ: لتنظيم→تنظيم");
  check(stripLeadingClitics("لوزارة") === "وزارة", "لوزارة→وزارة");
  check(stripLeadingClitics("والمحكمة") === "المحكمة", "تجريد واو العطف: والمحكمة→المحكمة");
  check(stripLeadingClitics("الوزارة") === "الوزارة", "لا يمسّ «ال» التعريف");
  const noisy = "المعاني المبينة أمام كل منها:\nلتنظيم: قواعد ضبط النشاط.\nمثل: عبارة ربط.\nالمحكمة: الجهة القضائية المختصة.";
  const cleaned = extractDefinedTerms(noisy).map((t) => t.term);
  console.log("    بعد التنقية:", cleaned.join(" | "));
  check(cleaned.includes("تنظيم") && !cleaned.includes("لتنظيم"), "«لتنظيم» تُجرَّد إلى «تنظيم»");
  check(!cleaned.includes("مثل"), "رابط «مثل» مرفوض");
  check(cleaned.includes("المحكمة"), "مصطلح سليم يبقى");
  check(TERM_STOPWORDS.has("وتشمل"), "قائمة الإيقاف تضمّ «وتشمل»");

  check(classifyConceptType("الوزارة", "وزارة التجارة") === "administrative_concept", "تصنيف «الوزارة» إداري");
  check(classifyConceptType("الترخيص", "وثيقة تصدرها الوزارة") !== "", "تصنيف غير فارغ");

  // scoring
  console.log("\n[scoring]");
  check(scoreDefinedTerm({ definitionLength: 40, termWordCount: 1 }) >= 95, "تعريف صريح واضح → ≥95");
  check(scoreDefinedTerm({ definitionLength: 8, termWordCount: 1 }) < 95, "تعريف قصير → أقل");
  check(scoreDefinedTerm({ definitionLength: 40, termWordCount: 1, sourceStatus: "needs_review" }) < 96, "مادة غير سارية → خصم");
  const rev = decideReview(80);
  check(rev.needsReview && rev.reasons.includes("confidence_below_85"), "ثقة <85 → مراجعة");
  check(conceptStatus(96, decideReview(96)) === "approved", "ثقة عالية بلا إشارات → معتمد");
  check(conceptStatus(96, decideReview(96, { nearExisting: true })) === "candidate", "قريب من موجود → مرشّح للمراجعة");

  console.log("\n" + "=".repeat(56));
  console.log(`النتيجة: ${passed} نجح، ${failed} فشل`);
  if (failed > 0) process.exit(1);
  console.log("✅ نجح اختبار مكتبة المكنز.");
}

main();

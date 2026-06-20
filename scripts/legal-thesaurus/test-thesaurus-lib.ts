/**
 * اختبار مكتبة المكنز (normalize + definitions + scoring) — نقيّ، بلا قاعدة.
 * التشغيل: npm run thesaurus:test
 */
import { normalizeText, searchableText, splitSentences, splitParagraphs, textHash } from "@/lib/modules/legal-thesaurus/normalize";
import { isDefinitionArticle, extractDefinedTerms, classifyConceptType, stripLeadingClitics, TERM_STOPWORDS } from "@/lib/modules/legal-thesaurus/definitions";
import { scoreDefinedTerm, decideReview, conceptStatus, scoreBodyConcept } from "@/lib/modules/legal-thesaurus/scoring";
import { scanArticleForConcepts, scanCompoundCandidates, scanCompoundPhrases, BODY_CONCEPT_LEXICON } from "@/lib/modules/legal-thesaurus/body-concepts";
import { classifyRecurrence, classifySourcePosition, positionRatioToClass, classifyScope } from "@/lib/modules/legal-thesaurus/recurrence";
import { matchInIndex, type ThesaurusEntry } from "@/lib/modules/legal-thesaurus/concept-index";

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
  // رفض ترويسات الأقسام/الأبواب (الإيجاب الزائف المرصود في الطيّار)
  const headerNoise = "المعاني المبينة أمام كل منها:\nالقسم الأول: الالتزامات والحقوق الشخصية.\nالوديعة: عقد يلتزم به المودع لديه بحفظ الشيء.";
  const cleanedHdr = extractDefinedTerms(headerNoise).map((t) => t.term);
  check(!cleanedHdr.includes("القسم الأول") && !cleanedHdr.some((t) => t.startsWith("القسم")), "ترويسة «القسم الأول» مرفوضة");
  check(cleanedHdr.includes("الوديعة"), "مصطلح سليم «الوديعة» يبقى رغم وجود ترويسة");
  // تنقية التعميم: بادئات التعداد + الشظايا + العبارات الجُملية
  const listNoise = "المعاني المبينة أمام كل منها:\nب - الهيئة: الجهة المشرفة.\nجـ - السلع: المنتجات المستوردة.\nالترخيص: وثيقة رسمية تصدرها الهيئة.";
  const listClean = extractDefinedTerms(listNoise).map((t) => t.term);
  check(listClean.includes("الهيئة") && !listClean.some((t) => t.startsWith("ب -")), "بادئة التعداد «ب -» تُجرَّد إلى «الهيئة»");
  check(listClean.includes("السلع"), "«جـ - السلع» تُجرَّد إلى «السلع»");
  const fragNoise = "المعاني المبينة أمام كل منها:\nالأصول: جميع المستندات التي تحمل قيمة نقدية مثل: نقد.\nالسجل: قيد نظامي.";
  const fragClean = extractDefinedTerms(fragNoise).map((t) => t.term);
  check(!fragClean.some((t) => t.includes("التي") || t.endsWith("مثل")), "شظية «…التي تحمل… مثل» مرفوضة");
  check(fragClean.includes("السجل"), "مصطلح سليم «السجل» يبقى رغم وجود شظية");

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

  // body-concepts (استخراج من كامل المتن)
  console.log("\n[body-concepts]");
  const body1 = "إذا توافرت شروط صحة العقد ترتب عليه أثره، وللدائن فسخ العقد عند الإخلال، ويلتزم المدين بالتعويض.";
  const hits1 = scanArticleForConcepts(body1);
  const labels1 = hits1.map((h) => h.entry.label);
  console.log("    مفاهيم المتن:", labels1.join(" | "));
  check(labels1.includes("شروط صحة العقد"), "التقاط عبارة مركّبة «شروط صحة العقد»");
  check(labels1.includes("فسخ العقد"), "التقاط «فسخ العقد»");
  check(labels1.includes("التعويض"), "التقاط «التعويض»");
  check(labels1.includes("الدائن") && labels1.includes("المدين"), "التقاط أطراف الالتزام");
  // الأزواج الدقيقة تبقى منفصلة (لا دمج)
  const grp = BODY_CONCEPT_LEXICON.filter((e) => e.carefulGroup === "termination_invalidity").map((e) => e.label);
  check(grp.includes("البطلان") && grp.includes("الفسخ") && grp.includes("الانفساخ"), "البطلان/الفسخ/الانفساخ مفاهيم منفصلة");
  const clitic = scanArticleForConcepts("والعقد ملزم، وبالعقد تنشأ الالتزامات، وللعقد آثاره.");
  check(clitic.some((h) => h.entry.label === "العقد"), "مطابقة السوابق المقطعية (والعقد/بالعقد/للعقد)");
  check(clitic.find((h) => h.entry.label === "العقد")!.count >= 3, "عدّ تكرار الورود داخل المادة");
  // استبعاد الكلمات العامة من المرشّحات
  const cands = scanCompoundCandidates("شروط منح الترخيص، وأحكام هذا النظام، ودعوى التعويض.");
  console.log("    مرشّحات مركّبة:", cands.map((c) => c.phrase).join(" | "));
  check(cands.some((c) => c.phrase.startsWith("شروط")), "التقاط عبارة مركّبة مرشّحة");
  check(!cands.some((c) => c.phrase.includes("هذا") || c.phrase.includes("النظام")), "استبعاد الكلمات العامة (هذا/النظام)");
  // الكشف المركّب المُوسَّع: رأس قانوني + وصف، مع رفض روابط الجُمَل
  const cph = scanCompoundPhrases("للمساهم حق التصويت في الجمعية، ويصدر سند الشحن، وحق عليه الالتزام.").map((c) => c.phrase);
  console.log("    عبارات مركّبة:", cph.join(" | "));
  check(cph.includes("حق التصويت"), "التقاط «حق التصويت» (رأس قانوني + وصف)");
  check(cph.includes("سند الشحن"), "التقاط «سند الشحن»");
  check(!cph.some((p) => p.split(" ")[1] === "عليه"), "رفض الوصف الرابط «حق عليه»");
  // تشديد المركّبات: رفض الرؤوس المكرّرة/إحالات المواد/المدد/الشظايا/الوصف المعطوف
  const noisyCph = scanCompoundPhrases("المجلس مجلس ادارة، واحكام النظام، وحكم المادة الثامنة، ولمدة ثلاث سنوات، والمجلس وقراراته، ومجلس الوزراء بناء على ذلك.").map((c) => c.phrase);
  console.log("    مركّبات بعد التشديد:", noisyCph.join(" | "));
  check(!noisyCph.some((p) => p.startsWith("المجلس مجلس") || p.startsWith("اللائحه اللائحه")), "رفض الرأس المكرّر «المجلس مجلس»");
  check(!noisyCph.some((p) => /النظام$/.test(p)) , "رفض إحالة عامة «احكام النظام»");
  check(!noisyCph.some((p) => p.includes("الماده") || p.includes("المادة")), "رفض إحالة مادة «حكم المادة»");
  check(!noisyCph.some((p) => /سنوات|ثلاث/.test(p)), "رفض المدد «لمدة ثلاث سنوات»");
  check(!noisyCph.some((p) => p.split(" ")[1] && /^[وف]/.test(p.split(" ")[1])), "رفض الوصف المعطوف «المجلس وقراراته»");
  check(noisyCph.includes("مجلس الوزراء"), "إبقاء «مجلس الوزراء» وإسقاط الشظية «بناء»");
  // رفض المُكمّلات/الصفات الكلامية (الجولة الثانية من التدقيق)
  const q2 = scanCompoundPhrases("للهيئة جميع الصلاحيات، والاحكام الصادرة، واللوائح ذات الصلة، وهيئة التحكيم الدائمة.").map((c) => c.phrase);
  console.log("    تدقيق ثانٍ:", q2.join(" | "));
  check(!q2.some((p) => p.split(" ")[1] === "جميع"), "رفض المُكمّل «جميع»");
  check(!q2.some((p) => p.includes("الصادره") || p.includes("الصادرة")), "رفض الصفة الكلامية «الصادرة»");
  check(!q2.some((p) => p.split(" ")[1] === "ذات"), "رفض «ذات»");
  check(q2.some((p) => p.startsWith("هيئه التحكيم")), "إبقاء «هيئة التحكيم»");

  // recurrence (برهان التكرار + الموقع + النطاق)
  console.log("\n[recurrence]");
  check(classifyRecurrence({ totalOccurrences: 1, distinctArticles: 1, distinctSources: 1 }) === "single_occurrence", "ورود واحد");
  check(classifyRecurrence({ totalOccurrences: 3, distinctArticles: 1, distinctSources: 1 }) === "repeated_in_same_article", "تكرار داخل المادة");
  check(classifyRecurrence({ totalOccurrences: 4, distinctArticles: 3, distinctSources: 1 }) === "repeated_in_same_system", "تكرار داخل النظام");
  check(classifyRecurrence({ totalOccurrences: 5, distinctArticles: 3, distinctSources: 2 }) === "repeated_across_systems", "تكرار عبر الأنظمة");
  check(classifyRecurrence({ totalOccurrences: 20, distinctArticles: 10, distinctSources: 1 }) === "high_frequency_core_concept", "مفهوم محوري عالي التردد");
  check(positionRatioToClass(0.1) === "early_articles" && positionRatioToClass(0.5) === "middle_articles" && positionRatioToClass(0.9) === "late_articles", "تصنيف نسبة الموقع");
  check(classifySourcePosition([0.1, 0.5, 0.9]) === "all_system", "ممتد على كامل النظام");
  check(classifySourcePosition([0.05, 0.1]) === "early_articles", "محصور في البداية");
  check(classifyScope(true, true) === "mixed" && classifyScope(true, false) === "definitions_only" && classifyScope(false, true) === "full_body", "تصنيف نطاق الاستخراج");
  check(scoreBodyConcept({ isCompound: true, distinctArticles: 9, totalOccurrences: 16, exactMatch: true, hasExplicitDefinition: false }) > scoreBodyConcept({ isCompound: false, distinctArticles: 1, totalOccurrences: 1, exactMatch: false }), "الثقة ترتفع بالتركيب والتكرار");
  check(scoreBodyConcept({ isCompound: false, distinctArticles: 1, totalOccurrences: 1, exactMatch: false, hasExplicitDefinition: true }) >= 95, "وجود تعريف صريح → ثقة عالية");

  // concept-index (توسيع البحث بمفاهيم المكنز — مطابقة نقيّة بلا قاعدة)
  console.log("\n[concept-index]");
  const fx: ThesaurusEntry[] = [
    { id: "c1", label: "عقد العمل", status: "approved", forms: [searchableText("عقد العمل")], synonyms: ["عقد العمل", "علاقة العمل"] },
    { id: "c2", label: "الفصل التعسفي", status: "approved", forms: [searchableText("الفصل التعسفي")], synonyms: ["الفصل التعسفي", "إنهاء تعسفي"] },
    { id: "c3", label: "الرهن", status: "candidate", forms: [searchableText("الرهن")], synonyms: ["الرهن", "الرهن الحيازي"] },
  ];
  const m1 = matchInIndex("ما حكم الفصل التعسفي للعامل؟", fx);
  check(m1.conceptIds.includes("c2"), "مطابقة عبارة مركّبة «الفصل التعسفي» (احتواء)");
  check(m1.synonyms.includes("إنهاء تعسفي"), "توسيع بمرادف المفهوم المُطابَق");
  const m2 = matchInIndex("نزاع حول الرهن العقاري", fx);
  check(m2.conceptIds.includes("c3"), "مطابقة كلمة مفردة «الرهن» كوحدة (token)");
  const m3 = matchInIndex("الرهنية معقدة", fx);
  check(!m3.conceptIds.includes("c3"), "عدم مطابقة «الرهن» داخل كلمة أخرى (دقّة الوحدة)");
  check(matchInIndex("", fx).synonyms.length === 0, "استعلام فارغ ⇒ بلا توسيع");
  check(matchInIndex("لا يوجد مفهوم هنا", fx).conceptIds.length === 0, "بلا مطابقة ⇒ فارغ");

  console.log("\n" + "=".repeat(56));
  console.log(`النتيجة: ${passed} نجح، ${failed} فشل`);
  if (failed > 0) process.exit(1);
  console.log("✅ نجح اختبار مكتبة المكنز.");
}

main();

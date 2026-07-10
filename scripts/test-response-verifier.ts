/**
 * اختبار مراجع الجودة (response-verifier) — نقيّ، بلا نموذج/قاعدة.
 * التشغيل: npm run test:response-verifier
 */
import { countQuestions, enforceSingleQuestion, verifyReply, finalizeReply, isRepeated } from "@/lib/modules/legal-chat/response-verifier";

let passed = 0;
let failed = 0;
const check = (cond: boolean, label: string) => {
  console.log(`  ${cond ? "✅" : "❌"} ${label}`);
  cond ? passed++ : failed++;
};

function main() {
  console.log("🧪 اختبار مراجع الجودة");
  console.log("=".repeat(56));

  check(countQuestions("كيف حالك؟ وما موضوعك؟") === 2, "عدّ الأسئلة");
  check(countQuestions("لا سؤال هنا.") === 0, "بلا أسئلة → 0");

  const single = enforceSingleQuestion("أهلاً. هل عندك دعوى؟ وهل صدر حكم؟ أخبرني.");
  check(countQuestions(single) === 1 && single.includes("هل عندك دعوى"), "فرض سؤال واحد (يقصّ عند الأول)");
  check(enforceSingleQuestion("سؤال واحد فقط؟") === "سؤال واحد فقط؟", "سؤال واحد يبقى كما هو");

  // verifyReply
  check(verifyReply("أهلاً بك، كيف أساعدك؟").ok, "ردّ سليم → ok");
  check(verifyReply("س؟ س٢؟").issues.includes("multiple_questions"), "أسئلة متعدّدة → issue");
  check(verifyReply("استنادًا إلى المادة (5).").issues.includes("unsourced_citation"), "استشهاد بلا مصدر → issue");
  check(verifyReply("").issues.includes("empty"), "فارغ → issue");
  const rep = verifyReply("نفس الردّ تمامًا", { recentReplies: ["نفس الردّ تمامًا"] });
  check(rep.issues.includes("repeated") && rep.repeated, "تكرار → issue + repeated");

  // finalizeReply: تجريد استشهاد + سؤال واحد
  const fin = finalizeReply("بموجب المادة (99) هل تريد المتابعة؟ وهل عندك مستند؟");
  check(!fin.includes("99") && countQuestions(fin) === 1, "التجريد + سؤال واحد معًا");

  // isRepeated
  check(isRepeated("مرحبا كيف حالك", ["مرحبا كيف حالك"]) === true, "isRepeated يكشف التطابق");
  check(isRepeated("نص مختلف تمامًا عن السابق", ["مرحبا كيف حالك"]) === false, "isRepeated لا يكشف المختلف");

  console.log("\n" + "=".repeat(56));
  console.log(`النتيجة: ${passed} نجح، ${failed} فشل`);
  if (failed > 0) process.exit(1);
  console.log("✅ نجح اختبار مراجع الجودة.");
}

main();

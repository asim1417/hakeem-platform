// اختبار المحقّق (المرحلة ٤): حقن استشهاد وهمي → يُحجَب. بلا قاعدة بيانات (مُتحقِّق محقون).
import { verifyCitations, isGrounded, type CitationValidator } from "../lib/modules/agents/thinking/verifier";

// مُتحقِّق وهمي: يعرف مادة واحدة حقيقية فقط (نظام العمل/74)؛ ما عداها غير مؤصَّل.
const fakeDb: CitationValidator = async (input) => {
  if (input.systemName?.includes("العمل") && input.articleNumber === 74) {
    return { ok: true, articleId: "real-1", systemName: "نظام العمل", articleNumber: 74, citationLabel: "نظام العمل — المادة (74)" };
  }
  if (input.articleId === "real-1") {
    return { ok: true, articleId: "real-1", systemName: "نظام العمل", articleNumber: 74, citationLabel: "نظام العمل — المادة (74)" };
  }
  return { ok: false, message: "لا مادة مطابقة في النواة" };
};

async function main() {
  const out = await verifyCitations(
    [
      { systemName: "نظام العمل", articleNumber: 74 },        // حقيقي
      { systemName: "نظام العمل", articleNumber: 9999 },      // وهمي (رقم غير موجود)
      { quote: "مادة مخترعة بلا مُعرّف" },                    // ملفَّق بلا مفتاح
    ],
    fakeDb
  );

  let ok = 0, fail = 0;
  const t = (cond: boolean, msg: string) => { console.log(`${cond ? "✓" : "✗"} ${msg}`); cond ? ok++ : fail++; };
  t(out.verified.length === 1, `مؤصَّل واحد فقط (=${out.verified.length})`);
  t(out.verified[0]?.articleNumber === 74, "المؤصَّل هو المادة 74 الحقيقية");
  t(out.blocked.length === 2, `محجوبان (=${out.blocked.length}): الوهمي + الملفَّق`);
  t(!out.blocked.some((b) => b.candidate.articleNumber === 74), "المادة الحقيقية لم تُحجَب");
  t(isGrounded(out) === true, "المخرَج مؤصَّل (يوجد سند مُتحقَّق)");

  // مخرَج بلا أي مؤصَّل → غير مؤصَّل (يستوجب الامتناع)
  const empty = await verifyCitations([{ systemName: "نظام وهمي", articleNumber: 1 }], fakeDb);
  t(isGrounded(empty) === false, "بلا سند مُتحقَّق → غير مؤصَّل (امتناع)");

  console.log(`\nنتيجة: ${ok} نجح، ${fail} فشل`);
  if (fail) process.exit(1);
}
main();

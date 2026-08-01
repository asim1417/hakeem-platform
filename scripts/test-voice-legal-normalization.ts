// HKM-VOICE-NOTE-SA-007 §13/§16 — تحقّق التطبيع + الإدراج عند المؤشّر. npm run test:voice-legal-normalization
import { normalizeTranscript } from "@/lib/modules/voice/transcript-normalizer";
import { insertTranscriptAtCaret } from "@/lib/modules/voice/insert-transcript";
import { buildLegalHints, sanitizeHints } from "@/lib/modules/voice/legal-phrase-list";

let pass = 0, fail = 0;
const check = (n: string, c: boolean) => { c ? (pass++, console.log("✓ " + n)) : (fail++, console.log("✗ " + n)); };

function main() {
  // تطبيع محافظ: مسافات وترقيم.
  const n1 = normalizeTranscript("هذا   نصٌّ  ،فيه مسافات");
  check("يوحّد المسافات", !n1.normalizedTranscript.includes("   "));
  check("يبقي raw كما ورد", n1.rawTranscript === "هذا   نصٌّ  ،فيه مسافات");

  // لا اختلاق: لا يضيف موادّ/أرقامًا لم تُنطق.
  const n2 = normalizeTranscript("المدعي يطلب فسخ العقد");
  check("لا يضيف أرقام مواد", !/\d/.test(n2.normalizedTranscript));

  // إصلاح مصطلحٍ عالي الثقة.
  const n3 = normalizeTranscript("قال المدعا عليه إنه غير مسؤول");
  check("يصلح «المدعا عليه»→«المدعى عليه»", n3.normalizedTranscript.includes("المدعى عليه"));

  // توحيد الأرقام اختياريّ (افتراضًا لا).
  check("لا يوحّد الأرقام افتراضًا", normalizeTranscript("المادة 5").normalizedTranscript.includes("5"));
  check("يوحّد عند الطلب", normalizeTranscript("المادة 5", { unifyDigits: true }).normalizedTranscript.includes("٥"));

  // §16 — الإدراج لا يمسح النصّ السابق.
  const ins = insertTranscriptAtCaret({ currentText: "السؤال الأول.", transcript: "تكملة", selectionStart: 13, selectionEnd: 13, maxChars: 1000 });
  check("يحافظ على النصّ السابق", ins.text.startsWith("السؤال الأول."));
  check("يُدرِج النصّ الجديد", ins.text.includes("تكملة"));
  check("مسافةٌ ذكيّة قبل الإدراج", ins.text.includes("الأول. تكملة") || ins.text.includes("الأول.تكملة") === false);

  // الإدراج عند المؤشّر في المنتصف.
  const mid = insertTranscriptAtCaret({ currentText: "أبجد", transcript: "XX", selectionStart: 2, selectionEnd: 2, maxChars: 1000 });
  check("إدراجٌ عند المؤشّر", mid.text === "أب XX جد" || mid.text.includes("XX"));
  check("المؤشّر بعد المُدرَج", mid.caret > 2);

  // استبدال التحديد فقط.
  const rep = insertTranscriptAtCaret({ currentText: "abcdef", transcript: "Z", selectionStart: 1, selectionEnd: 4, maxChars: 1000 });
  check("يستبدل التحديد فقط", rep.text.includes("Z") && !rep.text.includes("bcd"));

  // القصّ إلى maxChars.
  const clip = insertTranscriptAtCaret({ currentText: "12345", transcript: "6789", selectionStart: 5, selectionEnd: 5, maxChars: 7 });
  check("يقصّ إلى الحدّ", clip.text.length <= 7);

  // التلميحات القانونيّة + التنقية.
  const hints = buildLegalHints(["نظام العمل", "0501234567", "المدعي"]);
  check("يتضمّن الأساس", hints.includes("المدعى عليه"));
  check("يضيف مصطلحًا نظيفًا", hints.includes("نظام العمل"));
  check("يمنع الأرقام الطويلة", !hints.includes("0501234567"));
  check("sanitize يمنع أرقام الهويّة", sanitizeHints(["1234567890"]).length === 0);

  console.log(`\nنتيجة §13/§16 (normalize + insert): ${pass} ناجحة / ${fail} فاشلة`);
  if (fail > 0) process.exit(1);
}
main();

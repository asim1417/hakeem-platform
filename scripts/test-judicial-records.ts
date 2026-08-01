// ─────────────────────────────────────────────────────────────────────────────
// HKM-JDS-002 §18 — تحقّق محرّك محاضر الضبط (نقيّ).
// يفحص: كشف العناصر من النصّ، رصد اللازم الناقص، الاكتمال الشكليّ. لا اختلاق حضور.
//   npm run test:jds-records
// ─────────────────────────────────────────────────────────────────────────────
import { buildRecordScaffold, recordElementSpecs } from "@/lib/modules/judicial";

let pass = 0,
  fail = 0;
function check(name: string, cond: boolean) {
  if (cond) {
    pass += 1;
    console.log(`✓ ${name}`);
  } else {
    fail += 1;
    console.log(`✗ ${name}`);
  }
}

function main() {
  // ① مواصفة العناصر: فيها عناصرُ لازمة.
  const specs = recordElementSpecs();
  check("توجد عناصرُ لازمة", specs.some((s) => s.mandatory));

  // ② محضرٌ فارغ ⇒ نواقصُ لازمة + غير مكتمل.
  const empty = buildRecordScaffold({ recordText: "" });
  check("محضرٌ فارغ: غير مكتمل", empty.formallyComplete === false);
  check("محضرٌ فارغ: نواقصُ لازمة > 0", empty.missingMandatory.length > 0);

  // ③ نصٌّ يحوي عناصرَ فعليّة ⇒ تُكشَف (لا تُفترَض).
  const text =
    "بسم الله الرحمن الرحيم، افتتحت الجلسة في المحكمة التجارية بالدائرة الثالثة بتاريخ 1447هـ في القضية رقم 55. " +
    "حضر المدعي ووكيل المدعى عليه. الموضوع مطالبة مالية. أفاد المدعي بأقواله. قرّرت الدائرة التأجيل. القاضي وأمين السرّ.";
  const filled = buildRecordScaffold({ recordText: text });
  const present = (k: string) => filled.elements.find((e) => e.key === k)?.present === true;
  check("كُشِفت الديباجة", present("PREAMBLE"));
  check("كُشِفت المحكمة", present("COURT"));
  check("كُشِفت الدائرة", present("CIRCUIT"));
  check("كُشِف حضور الأطراف", present("PARTIES_PRESENT"));
  check("كُشِف ما تقرّر", present("DECISIONS"));

  // ④ عنصرٌ مفقودٌ لا يُدَّعى وجودُه.
  const noSig = buildRecordScaffold({ recordText: "المحكمة التجارية الدائرة الثالثة بتاريخ 1447هـ رقم 5" });
  check("توقيعٌ مفقود: يُعلَّم ناقصًا", noSig.elements.find((e) => e.key === "SIGNATURES")?.present === false);

  // ⑤ تمرير المفاتيح الصريحة يكمل الشكليّات.
  const allKeys = specs.filter((s) => s.mandatory).map((s) => s.key);
  const explicit = buildRecordScaffold({ presentKeys: allKeys });
  check("بكلّ المفاتيح اللازمة: مكتملٌ شكليًّا", explicit.formallyComplete === true);

  console.log(`\nنتيجة §18 (records): ${pass} ناجحة / ${fail} فاشلة`);
  if (fail > 0) process.exit(1);
}

main();

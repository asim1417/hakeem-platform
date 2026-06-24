/**
 * test-legal-governance.ts — اختبار وحدة لمستخرِجَي المرسوم والمبدأ القضائي.
 * لا يحتاج قاعدة بيانات — اختبار دوال خالصة بعيّنات واقعية.
 * التشغيل: npm run test:governance
 */
import { extractRoyalDecree, normalizeDigits } from "@/lib/modules/legal-core/decree-extractor";
import { extractPrinciple } from "@/lib/modules/legal-core/principle-extractor";
import { buildArticleEli, lawSlug, parseArticleEli } from "@/lib/modules/legal-core/eli";

let passed = 0;
let failed = 0;

function check(name: string, cond: boolean, detail?: string) {
  if (cond) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    console.error(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

console.log("\n— مستخرِج المرسوم الملكي —");
{
  const a = extractRoyalDecree("نظام المعاملات المدنية الصادر بالمرسوم الملكي رقم م/191 وتاريخ 29/11/1444هـ");
  check("صيغة لاتينية كاملة", a?.number === "م/191" && a?.hijriDate === "29/11/1444هـ", JSON.stringify(a));

  const b = extractRoyalDecree("بالمرسوم الملكي رقم (م/١٩) بتاريخ ١٤٣٩/٥/٢٣هـ");
  check("أرقام هندية + تاريخ هجري معكوس", b?.number === "م/19" && b?.hijriDate === "1439/5/23هـ", JSON.stringify(b));

  const c = extractRoyalDecree("صدر بالأمر الملكي رقم أ/90 وتاريخ 27/8/1412هـ");
  check("أمر ملكي أ/90", c?.kind === "أمر ملكي" && c?.number === "أ/90", JSON.stringify(c));

  const d = extractRoyalDecree("اعتُمد بقرار مجلس الوزراء رقم (436) وتاريخ 1442/7/19هـ");
  check("قرار مجلس الوزراء", d?.kind === "قرار مجلس الوزراء" && d?.number === "436", JSON.stringify(d));

  const e = extractRoyalDecree("هذه مادة لا تذكر أي مرسوم على الإطلاق");
  check("لا اختلاق عند الغياب", e === null, JSON.stringify(e));

  const f = extractRoyalDecree("المرسوم الملكي رقم م/5 دون تاريخ");
  check("رقم بلا تاريخ", f?.number === "م/5" && f?.hijriDate === null, JSON.stringify(f));

  check("توحيد الأرقام", normalizeDigits("م/١٢٣") === "م/123");
}

console.log("\n— مستخرِج المبدأ القضائي —");
{
  const labeled =
    "المبدأ: لا يجوز الحكم بالتعويض عن ضرر لم يثبت وقوعه يقينًا، والبيّنة على من ادّعى. " +
    "تتلخص وقائع هذه الدعوى في أن المدعي تقدّم بلائحة...";
  const p1 = extractPrinciple(labeled, null);
  check("استخراج مبدأ مُعنون", !!p1 && p1.method === "labeled" && /لا يجوز الحكم بالتعويض/.test(p1.principleText), JSON.stringify(p1));
  check("لا يتسرّب نصّ الوقائع للمبدأ", !!p1 && !/تتلخص وقائع/.test(p1.principleText));

  const headnote =
    "الأصل في العقود اللزوم، ولا ينفسخ العقد إلا برضا الطرفين أو بحكم قضائي. " +
    "وحيث إن المدعي طلب فسخ العقد لإخلال المدعى عليه...";
  const p2 = extractPrinciple(headnote, "فسخ العقد");
  check("استخراج headnote افتتاحي", !!p2 && p2.method === "headnote", JSON.stringify(p2));
  check("استخدام العنوان البديل", p2?.title === "فسخ العقد", JSON.stringify(p2?.title));

  const noisy = "بسم الله الرحمن الرحيم. الحمد لله وحده. إن المحكمة التجارية بعد الاطلاع على الأوراق...";
  const p3 = extractPrinciple(noisy, null);
  check("تجاهل المقدمات الشكلية", p3 === null, JSON.stringify(p3));

  const tooShort = extractPrinciple("حكم.", null);
  check("رفض النصّ القصير", tooShort === null);
}

console.log("\n— المعرّف التشريعي (ELI) —");
{
  // ملاحظة: التطبيع يوحّد ة→ه و ى→ي لثبات المعرّف، فالنتيجة المتوقّعة مطبّعة.
  const eli = buildArticleEli("نظام المعاملات المدنية", 1);
  check("بناء معرّف ELI", eli.id === `eli/sa/${lawSlug("نظام المعاملات المدنية")}/art/1`, JSON.stringify(eli));
  check("الـ slug مطبّع (ة→ه)", eli.id === "eli/sa/نظام-المعاملات-المدنيه/art/1", JSON.stringify(eli));

  // ثبات الـ slug رغم اختلاف التشكيل/الهمزات.
  check("ثبات الـ slug", lawSlug("نظام العمل") === lawSlug("نظام العَمَل"), `${lawSlug("نظام العمل")} vs ${lawSlug("نظام العَمَل")}`);

  const round = buildArticleEli("نظام العمل", 80);
  const parsed = parseArticleEli(round.id.split("/").slice(1)); // أزل البادئة "eli"
  check("تحليل ELI صحيح", parsed?.articleNumber === 80 && parsed?.slug === lawSlug("نظام العمل"), JSON.stringify(parsed));

  check("رفض مسار خاطئ", parseArticleEli(["sa", "x", "chapter", "3"]) === null);
  check("رفض رقم غير صحيح", parseArticleEli(["sa", "x", "art", "abc"]) === null);
}

console.log(`\nالنتيجة: ${passed} ناجح، ${failed} فاشل`);
if (failed > 0) process.exit(1);
console.log("✅ كل اختبارات الحوكمة القانونية ناجحة.\n");

// اختبارٌ كاشفٌ ومانعُ انحدار (HKM-LAW-PREAMBLE-002 §23–24): يُثبت أنّ مستورد hoqoqi يحفظ
// نصّ ما قبل المادة (الديباجة + أداة الإصدار) مادّةً رقم صفر، ولا يُسقطه، ولا يختلق ديباجةً
// لنظامٍ بلا مصدر. يعمل بلا قاعدة بيانات — على تحويلٍ نقيّ (buildImportModel) بمُدخَلٍ مُصطنَع
// يحاكي جداول hoqoqi (laws_lang.law_preamble + tools_issuance_law + law_articles).
import { buildImportModel } from "./import-hoqoqi-sql";

type Row = Record<string, string | number | null>;
const parsed = {
  tableNames: [] as string[],
  tables: new Map<string, Row[]>([
    ["laws", [{ id: "1" }, { id: "2" }]],
    ["laws_lang", [
      { law_id: "1", name: "نظام المعاملات المدنية", law_preamble: "بعون الله تعالى نحن سلمان بن عبدالعزيز آل سعود ملك المملكة العربية السعودية، بعد الاطلاع على النظام الأساسي للحكم، وبعد الاطلاع على قرار مجلس الوزراء..." },
      { law_id: "2", name: "نظامٌ بلا ديباجة في المصدر" }
    ]],
    ["tools_issuance_law", [
      { law_id: "1", tool_type: "مرسوم ملكي", tool_number: "م/191", date_h: "1444/11/29هـ", authority: "مجلس الوزراء", text: "رسمنا بما هو آت: أولًا: الموافقة على النظام. ثانيًا: يُنشر في الجريدة الرسمية." }
    ]],
    ["law_articles", [
      { id: "a1", law_id: "1", article_number: "1" },
      { id: "a2", law_id: "1", article_number: "2" },
      { id: "b1", law_id: "2", article_number: "1" }
    ]],
    ["law_articles_lang", [
      { article_id: "a1", title: "المادة الأولى", content: "نصّ المادة الأولى من نظام المعاملات المدنية." },
      { article_id: "a2", content: "نصّ المادة الثانية." },
      { article_id: "b1", content: "نصّ مادةٍ في النظام الثاني." }
    ]]
  ])
};

let pass = 0;
const fails: string[] = [];
function check(name: string, fn: () => void) {
  try { fn(); pass += 1; console.log(`✓ ${name}`); }
  catch (e) { fails.push(`✗ ${name}: ${e instanceof Error ? e.message : e}`); console.log(`✗ ${name}`); }
}
function assert(cond: unknown, msg: string) { if (!cond) throw new Error(msg); }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const model = buildImportModel(parsed as any);
const preamble1 = model.articles.find((a) => a.sourceSystemId === "1" && a.articleNumber === 0);
const preamble2 = model.articles.find((a) => a.sourceSystemId === "2" && a.articleNumber === 0);
const body1 = model.articles.filter((a) => a.sourceSystemId === "1" && a.articleNumber !== 0);

check("الديباجة تُلتقط مادّةً رقم صفر (لا تُسقَط)", () => {
  assert(preamble1, "يجب وجود مادّة ديباجة (رقم صفر) للنظام ذي المصدر");
  assert(preamble1!.title === "الديباجة", "عنوان الديباجة");
});

check("نصّ الديباجة الخام محفوظٌ حرفيًّا", () => {
  assert(preamble1!.content.includes("نحن سلمان بن عبدالعزيز"), "نصّ ديباجة النظام محفوظ");
  assert(preamble1!.content.includes("بعد الاطلاع على"), "حيثيات الاطلاع محفوظة");
});

check("أداة الإصدار (المرسوم) لا تُسقَط — رقمها ونصّها محفوظان", () => {
  assert((preamble1!.royalDecree ?? "").includes("م/191"), "رقم المرسوم محفوظ في royalDecree");
  assert(preamble1!.content.includes("م/191"), "المرسوم داخل نصّ الديباجة/أداة الإصدار");
  assert(preamble1!.content.includes("رسمنا بما هو آت"), "بند الموافقة محفوظ");
  assert(preamble1!.content.includes("مجلس الوزراء"), "الجهة المُصدِرة محفوظة");
});

check("المواد الموضوعيّة تبقى مرقّمةً صحيحةً (١، ٢) منفصلةً عن الديباجة", () => {
  assert(body1.length === 2, `مادّتان موضوعيّتان، وُجد ${body1.length}`);
  assert(body1.some((a) => a.articleNumber === 1) && body1.some((a) => a.articleNumber === 2), "الأرقام ١ و٢");
});

check("لا اختلاق: نظامٌ بلا ديباجةٍ في المصدر لا تُصنَع له ديباجة", () => {
  assert(!preamble2, "لا يجوز إنشاء مادّة ديباجة لنظامٍ بلا مصدرٍ لها");
});

check("الديباجة ليست ضمن invalidArticles (لم تُرفَض كرقمٍ ساقط)", () => {
  assert(!model.invalidArticles.includes(`preamble:1`), "الديباجة صالحة لا مرفوضة");
});

// منع الانحدار (§24): حين يحمل المصدر نصًّا سابقًا للمادة، يجب أن يُحفَظ — لا يُسقَط.
check("منع الانحدار: مصدرٌ فيه نصّ ما-قبل-المادة ⇒ ديباجةٌ محفوظة", () => {
  const sourceHasPreArticleContent = true; // laws_lang.law_preamble + tools_issuance_law للنظام ١
  if (sourceHasPreArticleContent) {
    assert(preamble1, "إسقاط نصّ ما-قبل-المادة انحدارٌ محظور");
    assert(preamble1!.content.length > 0, "نصّ ما-قبل-المادة غير فارغ");
  }
});

console.log(`\nنتيجة: ${pass} نجح، ${fails.length} فشل`);
if (fails.length) { console.log(fails.join("\n")); process.exit(1); }

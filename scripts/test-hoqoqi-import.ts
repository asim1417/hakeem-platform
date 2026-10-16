// اختبارٌ كاشفٌ ومانعُ انحدار (HKM-LAW-PREAMBLE-002 §23–24) على **بنية hoqoqi الحقيقيّة**
// (من فحص المصدر): laws(issuance_date_*) · laws_lang(king_name, law_preamble) · law_issuance_tools(title)
// · law_articles / law_articles_lang(title→رقم، text→نصّ). يعمل بلا قاعدة بيانات على buildImportModel.
import { buildImportModel } from "./import-hoqoqi-sql";

type Row = Record<string, string | number | null>;
const parsed = {
  tableNames: [] as string[],
  tables: new Map<string, Row[]>([
    ["laws", [
      { id: "1", category_id: "1", issuance_date_hj: "1444-11-29", issuance_date_gr: "2023-12-16", is_active: "1" },
      { id: "2", category_id: "1", is_active: "1" }
    ]],
    ["laws_lang", [
      { id: "1", law_id: "1", lang_id: "1", title: "نظام المعاملات المدنية", king_name: "سلمان بن عبدالعزيز آل سعود", law_preamble: "بعون الله تعالى، بعد الاطلاع على النظام الأساسي للحكم…" },
      { id: "2", law_id: "2", lang_id: "1", title: "نظامٌ بلا ديباجة في المصدر", king_name: "", law_preamble: "" }
    ]],
    ["law_issuance_tools", [
      { id: "1", law_id: "1", title: "مرسوم ملكي رقم (م/191) وتاريخ 1444/11/29هـ" }
    ]],
    ["law_articles", [
      { id: "a1", law_id: "1" },
      { id: "a2", law_id: "1" },
      { id: "b1", law_id: "2" }
    ]],
    ["law_articles_lang", [
      { id: "1", article_id: "a1", lang_id: "1", title: "المادة الأولى", text: "نصّ المادة الأولى من نظام المعاملات المدنية." },
      { id: "2", article_id: "a2", lang_id: "1", title: "المادة الثانية", text: "نصّ المادة الثانية." },
      { id: "3", article_id: "b1", lang_id: "1", title: "المادة الأولى", text: "نصّ مادةٍ في النظام الثاني." }
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
// DATA-001 (الخيار الثاني): الديباجة تُخزَّن على مستوى النظام (preambleContent) لا كمادة صفر.
const sys1 = model.systems.find((s) => s.sourceId === "1");
const sys2 = model.systems.find((s) => s.sourceId === "2");
const preamble1 = sys1?.preambleContent ?? "";
const body1 = model.articles.filter((a) => a.sourceSystemId === "1");

check("لا تُنشأ «مادة صفر» إطلاقًا (لا ديباجة كمادة)", () => {
  assert(!model.articles.some((a) => a.articleNumber === 0), "يجب ألا توجد أي مادة رقمها صفر في النموذج");
});

check("الديباجة تُحفظ على مستوى النظام (preambleContent)", () => {
  assert(preamble1.length > 0, "يجب وجود نصّ ديباجة للنظام ذي المصدر");
});

check("نصّ الديباجة الخام + اسم الملك محفوظان", () => {
  assert(preamble1.includes("بعون الله تعالى"), "نصّ ديباجة النظام محفوظ");
  assert(preamble1.includes("سلمان بن عبدالعزيز"), "اسم الملك المُصدِر محفوظ");
});

check("أداة الإصدار (law_issuance_tools.title) لا تُسقَط — نصّها ورقمها محفوظان", () => {
  assert((sys1?.royalDecree ?? "").includes("م/191"), "رقم المرسوم في royalDecree للنظام");
  assert(preamble1.includes("م/191"), "المرسوم داخل نصّ الديباجة/أداة الإصدار");
  assert(preamble1.includes("أداة الإصدار"), "عنوان كتلة أداة الإصدار");
});

check("تاريخ الإصدار (laws.issuance_date_*) محفوظ — هجريّ وميلاديّ", () => {
  assert(preamble1.includes("1444-11-29"), "التاريخ الهجريّ في النصّ");
  assert(preamble1.includes("2023-12-16"), "التاريخ الميلاديّ في النصّ");
  assert(sys1?.effectiveFrom === "2023-12-16", "effectiveFrom = التاريخ الميلاديّ على النظام");
});

check("المواد الموضوعيّة تبقى مرقّمةً من عنوانها (١، ٢) منفصلةً عن الديباجة", () => {
  assert(body1.length === 2, `مادّتان موضوعيّتان، وُجد ${body1.length}`);
  assert(body1.some((a) => a.articleNumber === 1) && body1.some((a) => a.articleNumber === 2), "الأرقام ١ و٢");
});

check("المرسوم/التاريخ يُنسبان لكلّ مادّةٍ في النظام (حقلٌ لكلّ مادّة)", () => {
  assert(body1.every((a) => (a.royalDecree ?? "").includes("م/191")), "royalDecree على مواد النظام");
  assert(body1.every((a) => a.effectiveFrom === "2023-12-16"), "effectiveFrom على مواد النظام");
});

check("لا اختلاق: نظامٌ بلا ديباجةٍ/أداةٍ/تاريخٍ في المصدر لا تُصنَع له ديباجة", () => {
  assert(!sys2?.preambleContent, "لا يجوز تأليف ديباجة لنظامٍ بلا مصدرٍ لها");
});

// منع الانحدار (§24): مصدرٌ فيه نصّ ما-قبل-المادة ⇒ يُحفَظ لا يُسقَط.
check("منع الانحدار: مصدرٌ فيه نصّ ما-قبل-المادة ⇒ ديباجةٌ محفوظة", () => {
  assert(preamble1.length > 0, "إسقاط نصّ ما-قبل-المادة انحدارٌ محظور");
});

console.log(`\nنتيجة: ${pass} نجح، ${fails.length} فشل`);
if (fails.length) { console.log(fails.join("\n")); process.exit(1); }

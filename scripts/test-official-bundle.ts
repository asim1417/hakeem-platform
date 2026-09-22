import { splitOfficialSystemBundle } from "../lib/modules/legal-core/official-bundle";

const html = `
<html><body>
<p>مرسوم ملكي رقم (م/191) وتاريخ 29/ 11 /1444هـ</p>
<p>بعون الله تعالى</p>
<p>نحن سلمان بن عبدالعزيز آل سعود</p>
<p>وبعد الاطلاع على قرار مجلس الوزراء رقم (820) وتاريخ 24/ 11 /1444هـ.</p>
<p>رسمنا بما هو آت:</p>
<p>أولاً: الموافقة على نظام المعاملات المدنية، بالصيغة المرافقة.</p>
<p>ثانياً: حكم مستقل في المرسوم.</p>
<p>سلمان بن عبدالعزيز آل سعود</p>

<p>قرار مجلس الوزراء رقم (820) وتاريخ 24/ 11 /1444هـ</p>
<p>إن مجلس الوزراء</p>
<p>بعد الاطلاع على مشروع النظام.</p>
<p>يقرر ما يلي:</p>
<p>أولاً: الموافقة على نظام المعاملات المدنية، بالصيغة المرافقة.</p>
<p>ثانياً: حكم مستقل في القرار.</p>
<p>رئيس مجلس الوزراء</p>

<h2>نظام المعاملات المدنية</h2>
<p>باب تمهيدي</p>
<p>المادة الأولى:</p>
<p>نص المادة الأولى.</p>
<p>المادة الثانية:</p>
<p>نص المادة الثانية.</p>
</body></html>
`;

const result = splitOfficialSystemBundle({
  htmlOrText: html,
  systemName: "نظام المعاملات المدنية",
  sourceUrl: "https://ncar.gov.sa/document-details/example",
  sourceCode: "NCAR",
});

let failed = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) console.log("✓", name);
  else { failed++; console.error("✗", name, detail ?? ""); }
}

check("الحزمة صالحة", result.ok, result.issues);
check("ثلاث وثائق", result.documents.length === 3, result.documents.map((d) => d.docType));
const royal = result.documents.find((d) => d.docType === "ROYAL_DECREE");
const cabinet = result.documents.find((d) => d.docType === "COUNCIL_DECISION");
const system = result.documents.find((d) => d.docType === "SYSTEM_TEXT");
check("المرسوم يحافظ على حكمه الثاني", Boolean(royal?.rawText.includes("حكم مستقل في المرسوم")));
check("لا يدخل القرار داخل المرسوم", !Boolean(royal?.rawText.includes("إن مجلس الوزراء")));
check("رقم قرار مجلس الوزراء 820", cabinet?.number === "820", cabinet?.number);
check("القرار يحافظ على منطوقه", Boolean(cabinet?.rawText.includes("حكم مستقل في القرار")));
check("نص النظام يبدأ بعنوانه", Boolean(system?.rawText.startsWith("نظام المعاملات المدنية")));
check("النظام يحوي المادة الأولى", Boolean(system?.rawText.includes("المادة الأولى")));

const withOpening = splitOfficialSystemBundle({
  htmlOrText: html.replace("<html><body>", "<html><body><p>بسم الله الرحمن الرحيم</p>"),
  systemName: "نظام المعاملات المدنية",
  sourceUrl: "https://ncar.gov.sa/document-details/example",
  sourceCode: "NCAR",
});
check("لا تسقط البسملة السابقة لعنوان المرسوم", Boolean(withOpening.documents.find(d => d.docType === "ROYAL_DECREE")?.rawText.startsWith("بسم الله الرحمن الرحيم")));
const definiteChapter = splitOfficialSystemBundle({
  htmlOrText: html.replace("باب تمهيدي", "الباب الأول"),
  systemName: "نظام المعاملات المدنية", sourceUrl: "https://ncar.gov.sa/document-details/example", sourceCode: "NCAR",
});
check("يتعرف عنوان النظام قبل الباب المعرف", definiteChapter.ok, definiteChapter.issues);
const stretched = splitOfficialSystemBundle({
  htmlOrText: html.replace("<h2>نظام المعاملات المدنية</h2>", "<h2>نظام المعـاملات المدنيـة</h2>"),
  systemName: "نظام المعاملات المدنية", sourceUrl: "https://ncar.gov.sa/document-details/example", sourceCode: "NCAR",
});
check("التطويل لا يمنع التعرف على العنوان", stretched.ok, stretched.issues);
check("يحفظ التطويل في المصدر", stretched.documents.find(d => d.docType === "SYSTEM_TEXT")?.rawText.startsWith("نظام المعـاملات المدنيـة") === true);
const variants = splitOfficialSystemBundle({
  htmlOrText: html.replace("رقم (م/191)", "رقم م/191")
    .replace("<p>قرار مجلس الوزراء رقم (820)", "<p>بسم الله الرحمن الرحيم</p><p>قرار رقم (820)")
    .replace("وتاريخ 24/ 11 /1444هـ</p>", "وتاريخ : 24/ 11 /1444هـ</p>")
    .replace("يقرر ما يلي:", "يُقرِّر"),
  systemName: "نظام المعاملات المدنية", sourceUrl: "https://ncar.gov.sa/document-details/example", sourceCode: "NCAR",
});
const variantCouncil = variants.documents.find(d => d.docType === "COUNCIL_DECISION");
check("صيغ عناوين العمل والتنفيذ والمحاماة", variants.ok, variants.issues);
check("رقم المرسوم بلا أقواس", variants.documents.find(d => d.docType === "ROYAL_DECREE")?.number === "م/191");
check("عنوان القرار المختصر يحفظ رقمه", variantCouncil?.number === "820");
check("بسملة القرار في وثيقته", variantCouncil?.rawText.startsWith("بسم الله الرحمن الرحيم") === true);
check("لا يلحق القرار المختصر بالمرسوم", !variants.documents.find(d => d.docType === "ROYAL_DECREE")?.rawText.includes("إن مجلس الوزراء"));
check("التشكيل محفوظ في المنطوق", variantCouncil?.rawText.includes("يُقرِّر") === true);
process.exit(failed ? 1 : 0);

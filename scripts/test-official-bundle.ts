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

process.exit(failed ? 1 : 0);

/**
 * اختبار انحدار لمستخرج الاستشهادات (scripts/citation-extractor.ts).
 * يشغّل المستخرج على حكم تمثيلي يغطّي كل أنماط الاستشهاد، ويقارن المخرجات
 * بحقيقة مرجعية ثابتة. يفشل (exit 1) إن نزل الاسترجاع أو الدقّة عن الحدّ.
 *
 * التشغيل: npm run qa:citations
 * إضافة نمط جديد؟ أضِف حالته في GROUND_TRUTH وتأكّد أنه يُلتقط.
 */
import { extractAllCitations } from "./citation-extractor";

// عتبات القبول — السلوك الحالي 100%/100% على هذه العيّنة.
const MIN_RECALL = 100;
const MIN_PRECISION = 100;

// ── حكم تجاري سعودي تمثيلي يحوي ٨ أنماط استشهاد ──
const JUDGMENT = `
بسم الله الرحمن الرحيم. الحمد لله وحده، وبعد:
ففي يوم الاثنين الموافق ١٤٤٦/٥/١٢هـ عُقدت الجلسة في الدعوى المقامة من شركة الوفاء للمقاولات
ضد مؤسسة البناء المتحد، بمطالبة قيمتها مليون ريال عن إخلال بعقد توريد.
وبعد سماع الطرفين والاطلاع على المستندات، فإن الدائرة تقرر الآتي:
أولاً: من حيث الاختصاص، فإن الدعوى تجارية وفق المادة (16) من نظام المحاكم التجارية،
وتختص بها هذه الدائرة.
ثانياً: من حيث الإثبات، فإن البيّنة على من ادّعى واليمين على من أنكر، وقد أقام المدعي بيّنته
المستندية، وتطبّق الدائرة المادة الثانية والأربعين من نظام الإثبات أمام المحاكم في شأن
حجية المحررات الموقّعة.
ثالثاً: ولمّا كانت العقود شريعة المتعاقدين، وقد ثبت إخلال المدعى عليه بالتزامه التعاقدي،
فإن الدائرة تستند إلى م/١٣٠ من نظام المعاملات المدنية في شأن فسخ العقد مع التعويض،
وكذلك المواد 95-99 من النظام ذاته في تقدير الضرر.
رابعاً: وفيما يتعلق بالإجراءات، روعيت أحكام المادة (٢٢) فقرة (ب) من نظام المرافعات الشرعية،
كما جرى التبليغ وفقاً لنظام التنفيذ.
لذلك حكمت الدائرة بفسخ العقد وإلزام المدعى عليه بأن يدفع للمدعي مبلغ ثمانمائة ألف ريال.
`;

// ── الحقيقة المرجعية (ما يفهمه قاضٍ بشري) ──
type GT = { num: string | null; system: string; note: string };
const GROUND_TRUTH: GT[] = [
  { num: "16",  system: "نظام المحاكم التجارية",     note: "المادة (16) [رقم صريح]" },
  { num: "3",   system: "نظام الإثبات أمام المحاكم", note: "البيّنة على من ادّعى [مبدأ فقهي]" },
  { num: "42",  system: "نظام الإثبات أمام المحاكم", note: "الثانية والأربعين [ترتيبي مركّب]" },
  { num: "30",  system: "نظام المعاملات المدنية",    note: "العقود شريعة المتعاقدين [مبدأ]" },
  { num: "130", system: "نظام المعاملات المدنية",    note: "م/١٣٠ [رقم عربي]" },
  { num: "95",  system: "نظام المعاملات المدنية",    note: "المواد 95-99 [نطاق → 95]" },
  { num: "96",  system: "نظام المعاملات المدنية",    note: "المواد 95-99 [نطاق → 96]" },
  { num: "97",  system: "نظام المعاملات المدنية",    note: "المواد 95-99 [نطاق → 97]" },
  { num: "98",  system: "نظام المعاملات المدنية",    note: "المواد 95-99 [نطاق → 98]" },
  { num: "99",  system: "نظام المعاملات المدنية",    note: "المواد 95-99 [نطاق → 99]" },
  { num: "22",  system: "نظام المرافعات الشرعية",    note: "المادة (٢٢) فقرة (ب) [فقرة]" },
  { num: null,  system: "نظام التنفيذ",              note: "وفقاً لنظام التنفيذ [إشارة نظام]" },
];

const key = (num: string | null, sys: string) => `${num ?? "null"}|${sys}`;

const found = extractAllCitations(JUDGMENT);
const foundKeys = new Set(found.map((c) => key(c.articleNumber, c.systemName)));
const gtKeys = new Set(GROUND_TRUTH.map((g) => key(g.num, g.system)));

const missed = GROUND_TRUTH.filter((g) => !foundKeys.has(key(g.num, g.system)));
const falsePositives = found.filter((c) => !gtKeys.has(key(c.articleNumber, c.systemName)));

const tp = GROUND_TRUTH.length - missed.length;
const recall = (tp / GROUND_TRUTH.length) * 100;
const precision = (tp / (tp + falsePositives.length)) * 100;

console.log("── اختبار استخراج الاستشهادات ──");
for (const g of GROUND_TRUTH) {
  console.log(`  ${foundKeys.has(key(g.num, g.system)) ? "✅" : "❌"} ${g.note}`);
}
if (falsePositives.length) {
  console.log("\n  إيجابيات كاذبة:");
  for (const c of falsePositives) {
    console.log(`  ⚠ ${c.systemName} م/${c.articleNumber ?? "—"} [${c.extractedBy}]`);
  }
}
console.log(`\n  استرجاع ${recall.toFixed(0)}% (${tp}/${GROUND_TRUTH.length}) · دقّة ${precision.toFixed(0)}%`);

if (recall < MIN_RECALL || precision < MIN_PRECISION) {
  console.error(`\n❌ فشل: الحدّ الأدنى استرجاع ${MIN_RECALL}% ودقّة ${MIN_PRECISION}%.`);
  process.exit(1);
}
console.log("\n✅ نجح اختبار استخراج الاستشهادات.");

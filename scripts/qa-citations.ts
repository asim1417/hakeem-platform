/**
 * اختبار انحدار لمستخرج الاستشهادات (scripts/citation-extractor.ts).
 * يشغّل المستخرج على عيّنات (تمثيلية + حكم حقيقي مستورد) ويقارن المخرجات
 * بحقيقة مرجعية ثابتة، مع تأكيدات سلبية (ما يجب ألا يُلتقط).
 * يفشل (exit 1) إن نزل الاسترجاع/الدقّة عن الحدّ أو التُقط محظور.
 *
 * التشغيل: npm run qa:citations
 */
import { extractAllCitations } from "./citation-extractor";

const MIN_RECALL = 100;
const MIN_PRECISION = 100;

type GT = { num: string | null; system: string; note: string };
type Case = {
  name: string;
  text: string;
  expected: GT[];
  // محظورات: رقم مادة يجب ألا يظهر (إيجابيات كاذبة معروفة، مثل أرقام المراسيم)
  forbidden?: { num: string; note: string }[];
};

const key = (num: string | null, sys: string) => `${num ?? "null"}|${sys}`;

const CASES: Case[] = [
  {
    name: "عيّنة تمثيلية — ٨ أنماط",
    text: `أولاً: الدعوى تجارية وفق المادة (16) من نظام المحاكم التجارية.
ثانياً: البيّنة على من ادّعى واليمين على من أنكر، وتطبّق الدائرة المادة الثانية والأربعين من نظام الإثبات أمام المحاكم.
ثالثاً: العقود شريعة المتعاقدين، وتستند الدائرة إلى م/١٣٠ من نظام المعاملات المدنية، وكذلك المواد 95-99 من النظام ذاته في تقدير الضرر.
رابعاً: روعيت أحكام المادة (٢٢) فقرة (ب) من نظام المرافعات الشرعية، وجرى التبليغ وفقاً لنظام التنفيذ.`,
    expected: [
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
    ],
  },
  {
    name: "حكم حقيقي مستورد — التماس إعادة نظر تجاري",
    text: `بما أن طالب التماس إعادة النظر مقيدة بأحوال نص عليها في المادة (٢٠٠) من نظام المرافعات الشرعية الصادر عام ١٤٣٥ه بمرسوم ملكي رقم (م/١) : (١- يحق لأي من الخصوم أن يلتمس إعادة النظر في الأحكام النهائية) .
وعليه فإن المدعى عليه قد تبلغ لشخصه بناءً على المادة (٥٧) من نظام المرافعات آنف الذكر : (إذا تبلغ المدعى عليه لشخصه أو وكيله في الدعوى نفسها بموعد الجلسة) مما تنتهي معه الدائرة إلى عدم قبول طلب الالتماس .`,
    expected: [
      { num: "200", system: "نظام المرافعات الشرعية", note: "المادة (٢٠٠) [وصف طويل بعد النظام]" },
      { num: "57",  system: "نظام المرافعات الشرعية", note: "المادة (٥٧) من نظام المرافعات آنف الذكر [إشارة مختصرة]" },
    ],
    forbidden: [
      { num: "1", note: "م/١ في «مرسوم ملكي رقم (م/١)» — رقم مرسوم لا مادة" },
    ],
  },
];

let totalTp = 0, totalGt = 0, totalFp = 0;
let forbiddenHit = false;

for (const c of CASES) {
  const found = extractAllCitations(c.text);
  const foundKeys = new Set(found.map((x) => key(x.articleNumber, x.systemName)));
  const gtKeys = new Set(c.expected.map((g) => key(g.num, g.system)));

  console.log(`\n── ${c.name} ──`);
  for (const g of c.expected) {
    const hit = foundKeys.has(key(g.num, g.system));
    console.log(`  ${hit ? "✅" : "❌"} ${g.note}`);
    hit ? totalTp++ : 0;
  }
  totalGt += c.expected.length;

  // محظورات: يجب ألا تظهر بأي نظام
  for (const f of c.forbidden ?? []) {
    const hit = found.find((x) => x.articleNumber === f.num);
    console.log(`  ${hit ? "❌" : "🛡️"} (محظور) ${f.note}${hit ? ` — التُقط خطأً كـ ${hit.systemName}` : ""}`);
    if (hit) forbiddenHit = true;
  }

  // إيجابيات كاذبة = ما خرج وليس في الحقيقة المرجعية
  const fp = found.filter((x) => !gtKeys.has(key(x.articleNumber, x.systemName)));
  totalFp += fp.length;
  for (const x of fp) console.log(`  ⚠ إيجابي كاذب: ${x.systemName} م/${x.articleNumber ?? "—"} [${x.extractedBy}]`);
}

const recall = (totalTp / totalGt) * 100;
const precision = (totalTp / (totalTp + totalFp)) * 100;
console.log(`\n══ الإجمالي: استرجاع ${recall.toFixed(0)}% (${totalTp}/${totalGt}) · دقّة ${precision.toFixed(0)}% ══`);

if (recall < MIN_RECALL || precision < MIN_PRECISION || forbiddenHit) {
  console.error(`\n❌ فشل: المطلوب استرجاع ≥${MIN_RECALL}% ودقّة ≥${MIN_PRECISION}% وبلا التقاط محظور.`);
  process.exit(1);
}
console.log("\n✅ نجح اختبار استخراج الاستشهادات.");

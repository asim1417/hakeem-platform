/**
 * core-systems.ts — البيانات الرسمية للأنظمة الأساسية الأحد‑عشر (ركائز حكيم)، مُتحقَّقة من
 * البوابة القانونية لوزارة العدل (laws.moj.gov.sa) — انظر reports/moj-core-systems.md.
 *
 * تُستعمل لتمييز بطاقات هذه الأنظمة: عدد المواد الرسمي، التصنيف، تاريخ الإصدار، اللائحة
 * التنفيذية (مُدرَجة الآن في القاعدة)، ورابط المصدر الرسمي. لا تُغيَّر إلا بمصدر رسمي.
 */

export type CoreSystemMeta = {
  /** اسم النظام كما هو في القاعدة (مطابقة دقيقة) */
  lawName: string;
  /** عدد المواد الرسمي (من statuteStructure على البوابة، أو من القاعدة لِما ليس على بوابة العدل) */
  officialArticles: number;
  /** التصنيف الرسمي على البوابة */
  classification: string;
  /** تاريخ الإصدار الهجري (YYYY-MM-DD) */
  issuanceDateH: string | null;
  /** معرّف النظام على بوابة العدل (Serial) — غياب يعني أن مصدره جهة أخرى */
  serial: string | null;
  /** رابط المصدر الرسمي على بوابة العدل */
  sourceUrl: string | null;
  /** الجهة المُصدِرة حين لا يكون على بوابة العدل */
  sourceNote?: string;
  /** اسم اللائحة التنفيذية في القاعدة (إن وُجدت) */
  regulationLawName: string | null;
  /** عدد مواد اللائحة الرسمي */
  regulationArticles: number | null;
  /** ترتيب العرض ضمن الركائز */
  order: number;
};

const legislationUrl = (serial: string) => `https://laws.moj.gov.sa/ar/legislation/${serial}`;

export const CORE_SYSTEMS: CoreSystemMeta[] = [
  { lawName: "نظام المعاملات المدنية", officialArticles: 721, classification: "القضاء", issuanceDateH: "1444-11-29", serial: "PBbHmywh1XMp-Kyv3NtQLg", sourceUrl: legislationUrl("PBbHmywh1XMp-Kyv3NtQLg"), regulationLawName: null, regulationArticles: null, order: 1 },
  { lawName: "نظام المرافعات الشرعية", officialArticles: 243, classification: "القضاء", issuanceDateH: "1435-01-22", serial: "sSe-gyvwrajdndY5P08WZg", sourceUrl: legislationUrl("sSe-gyvwrajdndY5P08WZg"), regulationLawName: "اللوائح التنفيذية لنظام المرافعات الشرعية", regulationArticles: 639, order: 2 },
  { lawName: "نظام الإثبات", officialArticles: 129, classification: "القضاء", issuanceDateH: "1443-05-26", serial: "UbB0wpvasVhoTAgmYKUA7A", sourceUrl: legislationUrl("UbB0wpvasVhoTAgmYKUA7A"), regulationLawName: null, regulationArticles: null, order: 3 },
  { lawName: "نظام الأحوال الشخصية", officialArticles: 252, classification: "القضاء", issuanceDateH: "1443-08-06", serial: "xt6PShke0baUTC0OdfS9AQ", sourceUrl: legislationUrl("xt6PShke0baUTC0OdfS9AQ"), regulationLawName: "لائحة نظام الأحوال الشخصية", regulationArticles: 41, order: 4 },
  { lawName: "نظام الإجراءات الجزائية", officialArticles: 222, classification: "القضاء", issuanceDateH: "1435-01-22", serial: "BdFRJFma6kPhQqhIh2f7eQ", sourceUrl: legislationUrl("BdFRJFma6kPhQqhIh2f7eQ"), regulationLawName: "اللائحة التنفيذية لنظام الإجراءات الجزائية", regulationArticles: 181, order: 5 },
  { lawName: "نظام الشركات", officialArticles: 281, classification: "الأنظمة التجارية", issuanceDateH: null, serial: null, sourceUrl: null, sourceNote: "المصدر: وزارة التجارة", regulationLawName: null, regulationArticles: null, order: 6 },
  { lawName: "نظام المحاكم التجارية", officialArticles: 96, classification: "القضاء", issuanceDateH: "1441-08-15", serial: "5-3nY9odCRxj7FPBTXJG0Q", sourceUrl: legislationUrl("5-3nY9odCRxj7FPBTXJG0Q"), regulationLawName: "اللائحة التنفيذية لنظام المحاكم التجارية", regulationArticles: 281, order: 7 },
  { lawName: "نظام العمل", officialArticles: 248, classification: "أنظمة العمل", issuanceDateH: null, serial: null, sourceUrl: null, sourceNote: "المصدر: وزارة الموارد البشرية", regulationLawName: null, regulationArticles: null, order: 8 },
  { lawName: "نظام الإفلاس", officialArticles: 231, classification: "الوثائق الأخرى", issuanceDateH: "1439-05-28", serial: "-FF20eK5iu1hvvKJe5GZVQ", sourceUrl: legislationUrl("-FF20eK5iu1hvvKJe5GZVQ"), regulationLawName: "اللائحة التنفيذية لنظام الإفلاس", regulationArticles: 98, order: 9 },
  { lawName: "نظام التوثيق", officialArticles: 57, classification: "التوثيق والثروة العقارية", issuanceDateH: "1441-11-19", serial: "g28zaD-gXzN_8DAm9qbydw", sourceUrl: legislationUrl("g28zaD-gXzN_8DAm9qbydw"), regulationLawName: "اللائحة التنفيذية لنظام التوثيق", regulationArticles: 31, order: 10 },
  { lawName: "نظام التحكيم", officialArticles: 58, classification: "الوسائل المساندة للقضاء (بدائل تسوية المنازعات)", issuanceDateH: "1433-05-24", serial: "b_jI6RVZmizpiPSUSqLs7g", sourceUrl: legislationUrl("b_jI6RVZmizpiPSUSqLs7g"), regulationLawName: "اللائحة التنفيذية لنظام التحكيم", regulationArticles: 19, order: 11 },
];

// تطبيع بسيط للمطابقة (تجريد التشكيل/التطويل، توحيد الهمزات وة/ى) — لمطابقة اسم النظام بمرونة.
function norm(s: string): string {
  return (s || "")
    .replace(/[ً-ْٰـ]/g, "")
    .replace(/[إأآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه")
    .replace(/\s+/g, " ").trim();
}

const BY_NORM = new Map(CORE_SYSTEMS.map((c) => [norm(c.lawName), c]));

/** يُعيد بيانات النظام الأساسي إن كان اسمه أحد الركائز الأحد‑عشر، وإلا null. */
export function getCoreSystemMeta(lawName: string | null | undefined): CoreSystemMeta | null {
  if (!lawName) return null;
  return BY_NORM.get(norm(lawName)) ?? null;
}

/** صيغة عرض للتاريخ الهجري: «1444-11-29» ← «29 / 11 / 1444هـ». */
export function formatHijri(d: string | null): string | null {
  if (!d) return null;
  const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return `${d}هـ`;
  const [, y, mo, day] = m;
  return `${Number(day)} / ${Number(mo)} / ${y}هـ`;
}

import {
  governmentOpenDataRegistry,
  type GovernmentOpenDataPlatform,
} from "./government-open-data";

const EXTENDED_GOVERNMENT_OPEN_DATA_SOURCES: GovernmentOpenDataPlatform[] = [
  {
    key: "saso_conformity_bodies",
    nameAr: "جهات تقويم المطابقة المقبولة",
    authority: "الهيئة السعودية للمواصفات والمقاييس والجودة",
    scope: "ENTITY",
    integration: "LIVE",
    officialUrl: "https://saso.gov.sa/en/sectors/NQS/compliance_assessment/Pages/Products_certificate.aspx",
    notesAr:
      "قائمة رسمية لجهات تقويم المطابقة المقبولة في نطاق شهادات المنتجات. المطابقة الحالية بالاسم المنشور وتبقى للمراجعة ولا تعني اعتمادًا خارج نطاق القائمة.",
  },
  {
    key: "ncec_qualified_environmental_agencies",
    nameAr: "الجهات المؤهلة في مجال الخدمات البيئية",
    authority: "المركز الوطني للرقابة على الالتزام البيئي",
    scope: "ENTITY",
    integration: "ADAPTER",
    officialUrl: "https://violation.ncec.gov.sa/orgsdata",
    notesAr:
      "القائمة الرسمية متاحة للعرض، لكن سجلات المنشآت لا تظهر بصورة مستقرة في استجابة الخادم من بيئة حكيم. يبقى المصدر Adapter حتى يتوفر endpoint منظم ومصرح أو مسار وصول ثابت؛ لا تُفسر النتيجة غير المتاحة كنفي للتأهيل.",
  },
  {
    key: "insurance_authority_licensed_companies",
    nameAr: "الشركات المرخصة في قطاع التأمين",
    authority: "هيئة التأمين",
    scope: "ENTITY",
    integration: "ADAPTER",
    officialUrl: "https://www.ia.gov.sa/ar/licenses",
    notesAr:
      "هيئة التأمين تنشر قائمة الشركات المرخصة رسميًا بصيغة PDF. يبقى المصدر Adapter إلى أن يثبت Parser مستقر وإصدار/تاريخ المستند في كل جولة دون الاعتماد على رابط ملف متغير.",
  },
  {
    key: "misa_open_data",
    nameAr: "البيانات المفتوحة للاستثمار",
    authority: "وزارة الاستثمار",
    scope: "CONTEXT",
    integration: "DISCOVERY",
    officialUrl: "https://misa.gov.sa/ar/resources/open-data/",
    notesAr:
      "مجموعات بيانات استثمارية مفتوحة وإحصاءات منشآت وتراخيص. تعامل حاليًا كسياق استثماري ولا تصبح دليل كيان إلا عند ثبوت مجموعة مستقرة بمعرفات منشأة صريحة.",
  },
];

export function extendedGovernmentOpenDataRegistry(): GovernmentOpenDataPlatform[] {
  const base = governmentOpenDataRegistry();
  const byKey = new Map(base.map((item) => [item.key, item]));
  for (const item of EXTENDED_GOVERNMENT_OPEN_DATA_SOURCES) byKey.set(item.key, { ...item });
  return [...byKey.values()];
}

export const GOVERNMENT_OPEN_DATA_EXTENSIONS = EXTENDED_GOVERNMENT_OPEN_DATA_SOURCES.map((item) => ({ ...item }));

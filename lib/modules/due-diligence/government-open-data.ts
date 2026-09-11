export type GovernmentOpenDataScope = "ENTITY" | "CONTEXT" | "CATALOG";
export type GovernmentOpenDataIntegration = "LIVE" | "ADAPTER" | "DISCOVERY" | "DEGRADED";

export type GovernmentOpenDataPlatform = {
  key: string;
  nameAr: string;
  authority: string;
  scope: GovernmentOpenDataScope;
  integration: GovernmentOpenDataIntegration;
  officialUrl: string;
  notesAr: string;
};

/**
 * Registry of official Saudi public/open-data sources relevant to corporate due diligence.
 * ENTITY sources may produce entity observations when an identifier/name match is present.
 * CONTEXT/CATALOG sources never become adverse entity evidence merely because the dataset exists.
 */
export const GOVERNMENT_OPEN_DATA_REGISTRY: GovernmentOpenDataPlatform[] = [
  {
    key: "national_open_data",
    nameAr: "المنصة الوطنية للبيانات المفتوحة",
    authority: "بنك البيانات الوطني / سدايا",
    scope: "CATALOG",
    integration: "DISCOVERY",
    officialUrl: "https://open.data.gov.sa/ar/home",
    notesAr: "بوابة مركزية لاكتشاف مجموعات البيانات الحكومية المفتوحة وواجهات البيانات الفورية. تُستخدم للاكتشاف والإسناد ولا تُحوَّل مجموعاتها العامة تلقائيًا إلى أدلة على كيان بعينه.",
  },
  {
    key: "saudi_commerce_gis",
    nameAr: "بيانات السجلات التجارية الجغرافية المفتوحة",
    authority: "وزارة التجارة",
    scope: "CONTEXT",
    integration: "LIVE",
    officialUrl: "https://mc.gov.sa/ar/About/Statistics/Pages/GISInfo.aspx",
    notesAr: "بيانات GIS مجمعة ومباشرة؛ سياقية فقط ولا تثبت تسجيل شركة محددة.",
  },
  {
    key: "sfda_licensed_establishments",
    nameAr: "قائمة المنشآت المرخصة",
    authority: "الهيئة العامة للغذاء والدواء",
    scope: "ENTITY",
    integration: "LIVE",
    officialUrl: "https://sfda.gov.sa/en/node/17597",
    notesAr: "مصدر رسمي ينشر اسم المنشأة والسجل التجاري ونوع القطاع والترخيص ورقمه والمدينة وتاريخ الانتهاء عبر Web Service معلن.",
  },
  {
    key: "sama_finance_entities",
    nameAr: "الجهات المالية المرخصة",
    authority: "البنك المركزي السعودي",
    scope: "ENTITY",
    integration: "LIVE",
    officialUrl: "https://www.sama.gov.sa/en-US/Supervision/LicenseEntities/Pages/MultiActivitiesLicensedEntities.aspx",
    notesAr: "قائمة رسمية منشورة لبعض شركات التمويل؛ مطابقة الاسم وحدها تبقى للمراجعة.",
  },
  {
    key: "sama_open_data",
    nameAr: "منصة البيانات المفتوحة للبنك المركزي",
    authority: "البنك المركزي السعودي",
    scope: "CONTEXT",
    integration: "DISCOVERY",
    officialUrl: "https://www.sama.gov.sa/ar-sa/Statistics/Pages/Summary.aspx",
    notesAr: "بيانات اقتصادية ومالية دورية مع API؛ سياقية للسوق ما لم تحمل مجموعة محددة معرفات كيان.",
  },
  {
    key: "cma_open_data",
    nameAr: "بيانات هيئة السوق المالية المفتوحة",
    authority: "هيئة السوق المالية",
    scope: "ENTITY",
    integration: "DEGRADED",
    officialUrl: "https://opendataapi.cma.gov.sa/",
    notesAr: "API رسمي معروف، لكن الاتصال من بيئة حكيم السحابية غير مستقر حاليًا؛ لا يظهر كمصدر حي حتى يستقر مسار الوصول.",
  },
  {
    key: "saip_open_data",
    nameAr: "البيانات المفتوحة للملكية الفكرية",
    authority: "الهيئة السعودية للملكية الفكرية",
    scope: "CATALOG",
    integration: "ADAPTER",
    officialUrl: "https://www.saip.gov.sa/ar/resources/tools-and-research/open-data",
    notesAr: "الهيئة تعلن إتاحة بيانات ملكية فكرية بصيغ مفتوحة وتربط بالمنصة الوطنية؛ موصل الكيان ينتظر endpoint/مجموعة مستقرة للعلامات.",
  },
  {
    key: "cst_iot_entities",
    nameAr: "مقدمو خدمات إنترنت الأشياء",
    authority: "هيئة الاتصالات والفضاء والتقنية",
    scope: "ENTITY",
    integration: "LIVE",
    officialUrl: "https://www.cst.gov.sa/en/knowledge-center/digital-knowledge/IOT/IoT-Landscape/IoT-Service-Providers",
    notesAr: "قائمة رسمية محدودة النطاق لمقدمي خدمات IoT المسجلين/المصرح لهم/المرخصين؛ لا تعمم على جميع تراخيص CST.",
  },
  {
    key: "moj_open_data",
    nameAr: "مكتبة البيانات المفتوحة العدلية",
    authority: "وزارة العدل",
    scope: "CONTEXT",
    integration: "DISCOVERY",
    officialUrl: "https://www.moj.gov.sa/ar/OpenData/Pages/Request.aspx",
    notesAr: "تقارير ومجموعات بيانات عدلية مفتوحة؛ الأحكام المنشورة في حكيم لها موصل مستقل وأكثر ملاءمة لمطابقة الكيان.",
  },
  {
    key: "mof_open_data",
    nameAr: "مكتبة البيانات المفتوحة المالية",
    authority: "وزارة المالية",
    scope: "CONTEXT",
    integration: "DISCOVERY",
    officialUrl: "https://www.mof.gov.sa/generalservcies/open-data/Pages/default.aspx",
    notesAr: "ميزانية واقتصاد كلي ومالية عامة؛ تستخدم كسياق اقتصادي لا كدليل مباشر على منشأة.",
  },
  {
    key: "mofa_open_data",
    nameAr: "منصة البيانات المفتوحة لوزارة الخارجية",
    authority: "وزارة الخارجية",
    scope: "CATALOG",
    integration: "DISCOVERY",
    officialUrl: "https://www.mofa.gov.sa/ar/OpenData/Pages/default.aspx",
    notesAr: "بوابة بيانات مفتوحة رسمية؛ تُفهرس للاكتشاف ولا تدخل Risk Score دون مجموعة كيان محددة.",
  },
  {
    key: "riyadh_open_data",
    nameAr: "بيانات أمانة منطقة الرياض المفتوحة",
    authority: "أمانة منطقة الرياض",
    scope: "CONTEXT",
    integration: "DISCOVERY",
    officialUrl: "https://www.alriyadh.gov.sa/ar/open-data",
    notesAr: "بيانات بلدية وجيومكانية ووقت فعلي؛ يمكن توسيعها لاحقًا إلى موصلات تراخيص بلدية محددة عند توفر معرفات منشآت.",
  },
  {
    key: "tourism_open_data",
    nameAr: "بيانات قطاع السياحة والضيافة",
    authority: "وزارة السياحة",
    scope: "CONTEXT",
    integration: "DISCOVERY",
    officialUrl: "https://www.mt.gov.sa/",
    notesAr: "إحصاءات منشآت الضيافة المرخصة والأداء السياحي؛ سياقية ما لم تتوفر قائمة منشآت بمعرفات قابلة للمطابقة.",
  },
  {
    key: "bog_open_data_api",
    nameAr: "واجهة البيانات المفتوحة لديوان المظالم",
    authority: "ديوان المظالم",
    scope: "CONTEXT",
    integration: "DISCOVERY",
    officialUrl: "https://www.bog.gov.sa/EServices/OpenData/Pages/APIDetails.aspx",
    notesAr: "الديوان يعلن خدمة API للبيانات المفتوحة؛ تُفهرس حاليًا إلى أن تحدد مجموعة قابلة لمطابقة كيان تجاري.",
  },
  {
    key: "shc_open_data",
    nameAr: "البيانات المفتوحة للمجلس الصحي السعودي",
    authority: "المجلس الصحي السعودي",
    scope: "CONTEXT",
    integration: "DISCOVERY",
    officialUrl: "https://shc.gov.sa/ar/EParticipation/OpenData/Pages/OpenDataUserManual.aspx",
    notesAr: "JSON/XML/CSV/Excel ودليل API؛ بيانات قطاعية صحية وليست افتراضيًا دليلًا على كيان.",
  },
];

export function governmentOpenDataRegistry() {
  return GOVERNMENT_OPEN_DATA_REGISTRY.map((item) => ({ ...item }));
}

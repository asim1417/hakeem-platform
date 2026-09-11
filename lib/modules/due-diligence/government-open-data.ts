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
 * Official Saudi public/open-data sources relevant to corporate due diligence.
 * ENTITY = may support entity matching when identifiers are available.
 * CONTEXT/CATALOG = discovery/market context only; never adverse entity evidence by existence alone.
 */
export const GOVERNMENT_OPEN_DATA_REGISTRY: GovernmentOpenDataPlatform[] = [
  {
    key: "national_open_data",
    nameAr: "المنصة الوطنية للبيانات المفتوحة",
    authority: "بنك البيانات الوطني / سدايا",
    scope: "CATALOG",
    integration: "DISCOVERY",
    officialUrl: "https://open.data.gov.sa/ar/home",
    notesAr: "البوابة الوطنية المركزية لاكتشاف مجموعات البيانات الحكومية والواجهات الفورية. تستخدم للاكتشاف والإسناد، ولا تتحول مجموعاتها العامة تلقائيًا إلى أدلة على كيان بعينه.",
  },
  {
    key: "saudi_commerce_gis",
    nameAr: "بيانات السجلات التجارية الجغرافية المفتوحة",
    authority: "وزارة التجارة",
    scope: "CONTEXT",
    integration: "LIVE",
    officialUrl: "https://mc.gov.sa/ar/About/Statistics/Pages/GISInfo.aspx",
    notesAr: "GIS رسمي مباشر ومجمع؛ سياقي فقط ولا يثبت تسجيل شركة محددة.",
  },
  {
    key: "sfda_licensed_establishments",
    nameAr: "قائمة المنشآت المرخصة",
    authority: "الهيئة العامة للغذاء والدواء",
    scope: "ENTITY",
    integration: "LIVE",
    officialUrl: "https://sfda.gov.sa/en/licensed-establishments-list",
    notesAr: "قائمة رسمية عامة عبر HTTPS تعرض اسم المنشأة والسجل التجاري ونوع القطاع والترخيص ورقمه؛ حكيم يفضل البحث بالسجل التجاري عند توفره.",
  },
  {
    key: "sama_finance_entities",
    nameAr: "الجهات المالية المرخصة",
    authority: "البنك المركزي السعودي",
    scope: "ENTITY",
    integration: "LIVE",
    officialUrl: "https://www.sama.gov.sa/en-US/Supervision/LicenseEntities/Pages/MultiActivitiesLicensedEntities.aspx",
    notesAr: "قائمة رسمية لبعض شركات التمويل؛ مطابقة الاسم وحدها تبقى للمراجعة ولا تستعير الرقم الموحد من المستخدم.",
  },
  {
    key: "sama_open_data",
    nameAr: "منصة البيانات المفتوحة للبنك المركزي",
    authority: "البنك المركزي السعودي",
    scope: "CONTEXT",
    integration: "DISCOVERY",
    officialUrl: "https://www.sama.gov.sa/ar-sa/Statistics/Pages/Summary.aspx",
    notesAr: "بيانات اقتصادية ومالية دورية وواجهات API؛ سياقية للسوق ما لم تحمل مجموعة محددة معرفات كيان.",
  },
  {
    key: "cma_open_data",
    nameAr: "بيانات هيئة السوق المالية المفتوحة",
    authority: "هيئة السوق المالية",
    scope: "ENTITY",
    integration: "DEGRADED",
    officialUrl: "https://opendataapi.cma.gov.sa/",
    notesAr: "API رسمي، لكن الاتصال من بيئة حكيم السحابية غير مستقر حاليًا؛ لا يظهر كمصدر حي حتى يستقر مسار الوصول.",
  },
  {
    key: "saip_open_data",
    nameAr: "البيانات المفتوحة للملكية الفكرية",
    authority: "الهيئة السعودية للملكية الفكرية",
    scope: "CATALOG",
    integration: "ADAPTER",
    officialUrl: "https://www.saip.gov.sa/ar/resources/tools-and-research/open-data",
    notesAr: "بيانات ملكية فكرية مفتوحة وربط بالمنصة الوطنية؛ موصل كيان العلامات ينتظر مجموعة/endpoint مستقرة ومصرحًا بها.",
  },
  {
    key: "cst_iot_entities",
    nameAr: "مقدمو خدمات إنترنت الأشياء",
    authority: "هيئة الاتصالات والفضاء والتقنية",
    scope: "ENTITY",
    integration: "LIVE",
    officialUrl: "https://www.cst.gov.sa/en/knowledge-center/digital-knowledge/IOT/IoT-Landscape/IoT-Service-Providers",
    notesAr: "قائمة رسمية محدودة النطاق لمقدمي IoT المسجلين/المصرح لهم/المرخصين؛ المطابقة بالاسم فقط تبقى للمراجعة ولا تعمم على جميع تراخيص CST.",
  },
  {
    key: "rega_fal_inquiry",
    nameAr: "الاستعلام عن رخص فال",
    authority: "الهيئة العامة للعقار",
    scope: "ENTITY",
    integration: "ADAPTER",
    officialUrl: "https://rega.gov.sa/en/rega-services/real-estate-enquiries/enquiring-about-the-fal-license/",
    notesAr: "خدمة رسمية فورية للتحقق من صلاحية واستخدام رخص فال للأفراد والمنشآت. لا يوجد endpoint عام موثق مثبت في حكيم حتى الآن، لذلك لا نجري التفافًا على الواجهة.",
  },
  {
    key: "zatca_open_data",
    nameAr: "واجهات البيانات المفتوحة للزكاة والضريبة والجمارك",
    authority: "هيئة الزكاة والضريبة والجمارك",
    scope: "CONTEXT",
    integration: "DISCOVERY",
    officialUrl: "https://zatca.gov.sa/ar/e-participation/PublicData/Pages/APIs.aspx",
    notesAr: "واجهات رسمية لفسوحات المنافذ والواردات والصادرات وحالة المنافذ وبيانات استكشافية؛ سياق تجاري ولوجستي لا يثبت حالة منشأة بعينها دون معرف كيان صريح.",
  },
  {
    key: "gastat_open_data_api",
    nameAr: "واجهات البيانات المفتوحة للإحصاء",
    authority: "الهيئة العامة للإحصاء",
    scope: "CONTEXT",
    integration: "ADAPTER",
    officialUrl: "https://dp.stats.gov.sa/?locale=en",
    notesAr: "بوابة مطورين رسمية لواجهات المؤشرات والبيانات الإحصائية. تتطلب إنشاء تطبيق والحصول على مفتاح مصادقة قبل تفعيل الجلب في حكيم.",
  },
  {
    key: "hrsd_open_data",
    nameAr: "البيانات المفتوحة للموارد البشرية والتنمية الاجتماعية",
    authority: "وزارة الموارد البشرية والتنمية الاجتماعية",
    scope: "CONTEXT",
    integration: "DISCOVERY",
    officialUrl: "https://www.hrsd.gov.sa/open-data",
    notesAr: "مجموعات وتقارير قابلة لإعادة الاستخدام، وترتبط بالمنصة الوطنية. تعامل كسياق سوق وعمل ما لم تتضمن مجموعة معرفات منشآت مناسبة.",
  },
  {
    key: "monshaat_open_data",
    nameAr: "البيانات المفتوحة لمنشآت",
    authority: "الهيئة العامة للمنشآت الصغيرة والمتوسطة",
    scope: "CATALOG",
    integration: "ADAPTER",
    officialUrl: "https://www.monshaat.gov.sa/en/node/12825",
    notesAr: "منصة رسمية مجانية للبيانات المفتوحة. أي بيانات مؤسسة/سجل لا تصبح Entity-level حتى تثبت مجموعة بيانات مستقرة وحقول معرفات مناسبة.",
  },
  {
    key: "balady_open_data_api",
    nameAr: "واجهة البيانات المفتوحة لبلدي",
    authority: "وزارة البلديات والإسكان / منصة بلدي",
    scope: "CATALOG",
    integration: "LIVE",
    officialUrl: "https://apiservices.balady.gov.sa/v1/momrah-services/open-data",
    notesAr: "API رسمي موثق لمجموعات البيانات البلدية. متصل عبر Open Data Hub للاكتشاف؛ بيانات الرخص المجمعة لا تُعامل كرخصة منشأة بعينها دون موصل كيان مستقل.",
  },
  {
    key: "moj_open_data",
    nameAr: "مكتبة البيانات المفتوحة العدلية",
    authority: "وزارة العدل",
    scope: "CONTEXT",
    integration: "DISCOVERY",
    officialUrl: "https://www.moj.gov.sa/ar/OpenData/Pages/Request.aspx",
    notesAr: "تقارير ومجموعات عدلية مفتوحة؛ الأحكام المنشورة في حكيم لها موصل مستقل وأكثر ملاءمة لمطابقة الكيان.",
  },
  {
    key: "mof_open_data",
    nameAr: "مكتبة البيانات المفتوحة المالية",
    authority: "وزارة المالية",
    scope: "CONTEXT",
    integration: "DISCOVERY",
    officialUrl: "https://www.mof.gov.sa/generalservcies/open-data/Pages/default.aspx",
    notesAr: "ميزانية واقتصاد كلي ومالية عامة؛ سياق اقتصادي لا دليل مباشر على منشأة.",
  },
  {
    key: "mofa_open_data",
    nameAr: "منصة البيانات المفتوحة لوزارة الخارجية",
    authority: "وزارة الخارجية",
    scope: "CATALOG",
    integration: "DISCOVERY",
    officialUrl: "https://www.mofa.gov.sa/ar/OpenData/Pages/default.aspx",
    notesAr: "بوابة بيانات مفتوحة رسمية؛ مفهرسة للاكتشاف ولا تدخل Risk Score دون مجموعة كيان محددة.",
  },
  {
    key: "riyadh_open_data",
    nameAr: "بيانات أمانة منطقة الرياض المفتوحة",
    authority: "أمانة منطقة الرياض",
    scope: "CONTEXT",
    integration: "DISCOVERY",
    officialUrl: "https://www.alriyadh.gov.sa/ar/open-data",
    notesAr: "بيانات بلدية وجيومكانية؛ يمكن ترقيتها إلى Entity-level فقط عند وجود معرف منشأة موثق في مجموعة محددة.",
  },
  {
    key: "tourism_open_data",
    nameAr: "بيانات قطاع السياحة والضيافة",
    authority: "وزارة السياحة",
    scope: "CONTEXT",
    integration: "DISCOVERY",
    officialUrl: "https://www.mt.gov.sa/",
    notesAr: "إحصاءات قطاع الضيافة والأداء السياحي؛ سياقية إلى أن تتوفر قائمة منشآت بمعرفات قابلة للمطابقة.",
  },
  {
    key: "mim_industry_open_data",
    nameAr: "بيانات الصناعة والثروة المعدنية المفتوحة",
    authority: "وزارة الصناعة والثروة المعدنية",
    scope: "CONTEXT",
    integration: "DISCOVERY",
    officialUrl: "https://mim.gov.sa/en/",
    notesAr: "الوزارة تعرض مؤشرات صناعية وتعدينية وروابط بيانات مفتوحة؛ تعامل كسياق قطاعي إلى أن تثبت مجموعة تراخيص منشآت قابلة للمطابقة المباشرة.",
  },
  {
    key: "bog_open_data_api",
    nameAr: "واجهة البيانات المفتوحة لديوان المظالم",
    authority: "ديوان المظالم",
    scope: "CONTEXT",
    integration: "DISCOVERY",
    officialUrl: "https://www.bog.gov.sa/EServices/OpenData/Pages/APIDetails.aspx",
    notesAr: "خدمة API معلنة للبيانات المفتوحة؛ مفهرسة إلى أن تحدد مجموعة تصلح لمطابقة كيان تجاري.",
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

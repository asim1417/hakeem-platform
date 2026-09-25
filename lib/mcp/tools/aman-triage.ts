/**
 * طبقة «أمان» لخادم MCP الخاص بحكيم.
 *
 * هذا الملف لا يحفظ أي ملف قضية ولا ينشئ تواصلاً مع المكتب. وظيفته محصورة في
 * فرز المجال القانوني، إيضاح نطاق الخدمة، وإرجاع رابطٍ يختاره المستخدم بنفسه.
 * لذلك لا يطلب أسماء الخصوم أو الهويات أو المستندات أو ملخص الوقائع.
 */

export const AMAN_LEGAL_AREAS = [
  "execution",
  "commercial",
  "civil",
  "labor",
  "personal_status",
  "real_estate_endowments",
  "tax_zakat",
  "arbitration",
  "intellectual_property",
  "criminal",
  "general",
] as const;

export const AMAN_URGENCY_LEVELS = ["urgent", "normal", "planning"] as const;
export const AMAN_CONTACT_CHANNELS = ["website", "whatsapp", "phone"] as const;

export type AmanLegalArea = (typeof AMAN_LEGAL_AREAS)[number];
export type AmanUrgency = (typeof AMAN_URGENCY_LEVELS)[number];
export type AmanContactChannel = (typeof AMAN_CONTACT_CHANNELS)[number];

type AmanService = {
  areaLabel: string;
  title: string;
  description: string;
  focus: string[];
  suggestedDocuments: string[];
  nextSteps: string[];
};

export type AmanContactOption = {
  channel: AmanContactChannel;
  label: string;
  href: string;
  note: string;
};

export type AmanPolicyLink = {
  label: string;
  href: string;
};

export type AmanServiceCard = {
  version: "1.0";
  legal_area: AmanLegalArea;
  legal_area_label: string;
  urgency: AmanUrgency;
  urgency_label: string;
  service: Omit<AmanService, "areaLabel">;
  recommended_steps: string[];
  suggested_documents: string[];
  contact_options: AmanContactOption[];
  policy_links: AmanPolicyLink[];
  privacy_notice: string;
  legal_notice: string;
  hakeem_next_step: string;
};

// القنوات المنشورة رسمياً لشركة أمان. يمكن تجاوزها بمتغيرات البيئة عند تغيّرها.
const DEFAULT_CONSULTATION_URL = "https://amanlaws.com/legal-consultation/";
const DEFAULT_WHATSAPP_URL = "https://wa.me/966575555420";
const DEFAULT_PHONE = "+966575555420";
// سياسة وشروط واجهة MCP نفسها مستضافتان مع تطبيق حكيم، لا في رابط خدمة طرف ثالث.
const DEFAULT_PRIVACY_URL = "https://hakeem-platform.vercel.app/privacy";
const DEFAULT_TERMS_URL = "https://hakeem-platform.vercel.app/terms";

const SERVICE_BY_AREA: Record<AmanLegalArea, AmanService> = {
  execution: {
    areaLabel: "التنفيذ",
    title: "التنفيذ والمنازعات التنفيذية",
    description: "دعم في إجراءات التنفيذ، الاعتراضات والطلبات المرتبطة بالسند التنفيذي، وتمثيل صاحب المصلحة أمام الجهات المختصة.",
    focus: ["تقييم السند التنفيذي", "طلبات وإجراءات التنفيذ", "المنازعات والاعتراضات التنفيذية"],
    suggestedDocuments: ["السند التنفيذي أو الحكم", "قرارات وإشعارات التنفيذ", "العقود أو الإقرارات ذات الصلة"],
    nextSteps: ["حدد رقم طلب التنفيذ أو نوع السند دون مشاركته في الدردشة", "اجمع آخر قرار أو إشعار رسمي", "اطلب استشارة لتقييم الإجراء العاجل"],
  },
  commercial: {
    areaLabel: "التجاري",
    title: "القضايا والعقود التجارية",
    description: "تمثيل ومراجعة في المنازعات التجارية والعقود والشراكات والمعاملات بين الشركات والأفراد.",
    focus: ["المطالبات التجارية", "العقود والشراكات", "التحصيل والمسؤولية التعاقدية"],
    suggestedDocuments: ["العقد أو العرض المعتمد", "المراسلات والفواتير", "محاضر الاجتماعات أو التسويات"],
    nextSteps: ["رتب التسلسل الزمني للعلاقة", "حدد المطلوب المالي أو الإجرائي", "اطلب مراجعة قانونية للعقد والمستندات"],
  },
  civil: {
    areaLabel: "المدني",
    title: "المعاملات المدنية والتعويض",
    description: "تحليل أولي للمسائل المدنية، الالتزامات، المسؤولية والتعويض، مع بناء مسار إجرائي مناسب.",
    focus: ["العقود المدنية", "المسؤولية والتعويض", "الفسخ والتنفيذ العيني"],
    suggestedDocuments: ["العقد أو الاتفاق", "إثبات الضرر أو الإخلال", "الإعذارات والمراسلات"],
    nextSteps: ["حدد العلاقة والالتزام محل النزاع", "احتفظ بالمستندات الأصلية", "اطلب تقييمًا لنوع الدعوى والإثبات"],
  },
  labor: {
    areaLabel: "العمالي",
    title: "القضايا العمالية",
    description: "مساندة أصحاب العمل والعاملين في المطالبات العمالية والعقود وإنهاء العلاقة الوظيفية.",
    focus: ["الأجور والمستحقات", "الفصل وإنهاء العقد", "لوائح العمل والتحقيقات"],
    suggestedDocuments: ["عقد العمل", "بيانات الأجر والحضور", "قرارات الإنذار أو الإنهاء"],
    nextSteps: ["دوّن التواريخ الجوهرية", "تحقق من مهلة المطالبة", "اطلب مراجعة المستندات قبل الإجراء"],
  },
  personal_status: {
    areaLabel: "الأحوال الشخصية والتركات",
    title: "الأحوال الشخصية والتركات والأوقاف",
    description: "تمثيل ومساندة في مسائل الأسرة والتركات والوصايا والأوقاف ضمن ما يلزم من توثيق وإجراءات.",
    focus: ["التركات والوصايا", "النفقة والحضانة", "الأوقاف وإدارتها"],
    suggestedDocuments: ["صكوك أو وثائق الحالة ذات الصلة", "حصر الورثة أو بيانات التركة عند وجودها", "الوصية أو وثيقة الوقف إن وجدت"],
    nextSteps: ["لا تشارك بيانات الأسرة أو الهويات هنا", "حدد الهدف الإجرائي العام", "اطلب قناة تواصل آمنة قبل إرسال الوثائق"],
  },
  real_estate_endowments: {
    areaLabel: "العقار والأوقاف",
    title: "العقار والأوقاف",
    description: "مساندة في المنازعات والتصرفات العقارية وما يرتبط بالأوقاف وحقوق الانتفاع والإثبات.",
    focus: ["العقود والتصرفات العقارية", "الحقوق العينية والانتفاع", "إدارة ونزاعات الأوقاف"],
    suggestedDocuments: ["العقد أو الصك أو الإقرار", "المخططات والمراسلات", "مستندات الوقف أو الإيجار"],
    nextSteps: ["تحقق من المستند الحاكم للعلاقة", "لا ترفع الصك أو الهوية في المحادثة", "اطلب فحصًا قانونيًا للمستندات عبر القناة الآمنة"],
  },
  tax_zakat: {
    areaLabel: "الزكاة والضريبة",
    title: "الزكاة والضريبة",
    description: "دعم في الاعتراضات والمراجعات الزكوية والضريبية والالتزامات المرتبطة بالمنشآت.",
    focus: ["الاعتراضات الزكوية والضريبية", "المراجعة والامتثال", "المخالفات والإجراءات"],
    suggestedDocuments: ["الربط أو القرار", "الإقرارات والاعتراضات السابقة", "القوائم والمستندات المؤيدة"],
    nextSteps: ["حدد تاريخ التبليغ والمهلة", "رتب القرار والمرفقات", "اطلب تقييمًا لمسار الاعتراض"],
  },
  arbitration: {
    areaLabel: "التحكيم",
    title: "التحكيم والمنازعات البديلة",
    description: "مساندة في اتفاقات التحكيم، التمثيل، تعيين المحكمين، وإدارة إجراءات النزاع البديلة.",
    focus: ["شرط واتفاق التحكيم", "إجراءات التحكيم", "تنفيذ أو بطلان الحكم التحكيمي"],
    suggestedDocuments: ["العقد المتضمن شرط التحكيم", "الإشعارات والمراسلات", "أوامر أو أحكام التحكيم إن وجدت"],
    nextSteps: ["تحقق من صياغة شرط التحكيم", "ثبّت التواريخ والمطالبات", "اطلب تقييمًا للاختصاص والإجراء"],
  },
  intellectual_property: {
    areaLabel: "الملكية الفكرية",
    title: "العلامات التجارية والملكية الفكرية",
    description: "مساندة في العلامات التجارية والحقوق الفكرية والمنازعات والإجراءات المتعلقة بها.",
    focus: ["تسجيل وحماية العلامات", "الاعتراضات والنزاعات", "التراخيص والاستخدام"],
    suggestedDocuments: ["شهادة التسجيل أو الطلب", "نماذج الاستعمال أو التقليد", "العقود والتراخيص"],
    nextSteps: ["حدد رقم الطلب أو التسجيل خارج المحادثة", "احتفظ بأدلة الاستعمال", "اطلب مراجعة للحماية أو الاعتراض"],
  },
  criminal: {
    areaLabel: "الجزائي",
    title: "المسائل الجزائية والإجرائية",
    description: "مساندة قانونية في المسائل الجزائية والإجراءات ذات الصلة وفقًا لظروف القضية وحقوق أطرافها.",
    focus: ["الإجراءات والتمثيل", "الشكوى والدفاع", "الضمانات الإجرائية"],
    suggestedDocuments: ["الإشعار أو المحضر الرسمي", "التبليغات ذات الصلة", "التوكيل أو المستندات الإجرائية"],
    nextSteps: ["إن وُجد توقيف أو مهلة عاجلة فاطلب تواصلًا مباشرًا", "لا تكتب اعترافات أو بيانات حساسة هنا", "استخدم قناة رسمية وآمنة للمستندات"],
  },
  general: {
    areaLabel: "استشارة عامة",
    title: "توجيه قانوني أولي",
    description: "فرز أولي للمسألة وتحديد المجال القانوني والمسار المناسب قبل الاستشارة المتخصصة.",
    focus: ["تحديد المجال القانوني", "خريطة الإجراء الأولية", "اختيار الخدمة المناسبة"],
    suggestedDocuments: ["ملخص زمني مختصر", "أي عقد أو قرار ذي صلة", "قائمة بالأسئلة المطلوب حسمها"],
    nextSteps: ["حدد المجال الأقرب لمسألتك", "احتفظ بالوثائق دون رفعها هنا", "اطلب استشارة لتحديد الإجراء المناسب"],
  },
};

const URGENCY_LABEL: Record<AmanUrgency, string> = {
  urgent: "عاجل",
  normal: "اعتيادي",
  planning: "تخطيط أو مراجعة وقائية",
};

function safeUrl(raw: string | undefined, kind: "website" | "whatsapp") {
  if (!raw) return undefined;

  try {
    const url = new URL(raw.trim());
    const host = url.hostname.toLowerCase();
    const isAmanDomain = host === "amanlaws.com" || host.endsWith(".amanlaws.com");
    const isWhatsAppDomain = host === "wa.me" || host === "api.whatsapp.com" || host.endsWith(".whatsapp.com");

    if (url.protocol !== "https:") return undefined;
    if (kind === "website" && !isAmanDomain) return undefined;
    if (kind === "whatsapp" && !isWhatsAppDomain) return undefined;

    return url.toString();
  } catch {
    return undefined;
  }
}

/** رابط سياسة/شروط موثوق: نطاق أمان أو أصل تطبيق حكيم فقط. */
function safePolicyUrl(raw: string | undefined) {
  if (!raw) return undefined;

  try {
    const url = new URL(raw.trim());
    const host = url.hostname.toLowerCase();
    const isAmanDomain = host === "amanlaws.com" || host.endsWith(".amanlaws.com");
    const isHakeemDomain = host === "hakeem-platform.vercel.app";
    return url.protocol === "https:" && (isAmanDomain || isHakeemDomain) ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function safePhone(raw: string | undefined) {
  const normalised = raw?.replace(/[^\d+]/g, "");
  return normalised && /^\+?\d{8,15}$/.test(normalised) ? normalised : undefined;
}

function getContactOptions(preference: AmanContactChannel = "website"): AmanContactOption[] {
  const options: AmanContactOption[] = [];
  // يبقى مسار الموقع الرسمي هو البديل الآمن إذا كُتبت قيمة بيئة خاطئة أو نطاق غير تابع لأمان.
  const website =
    safeUrl(process.env.AMAN_CONSULTATION_URL, "website") ??
    safeUrl(DEFAULT_CONSULTATION_URL, "website");
  const whatsapp =
    safeUrl(process.env.AMAN_WHATSAPP_URL, "whatsapp") ??
    safeUrl(DEFAULT_WHATSAPP_URL, "whatsapp");
  const phone = safePhone(process.env.AMAN_PHONE) ?? safePhone(DEFAULT_PHONE);

  if (website) {
    options.push({
      channel: "website",
      label: "طلب استشارة عبر بوابة أمان",
      href: website,
      note: "ينتقل المستخدم بنفسه إلى بوابة أمان الآمنة لاستكمال الطلب.",
    });
  }

  if (whatsapp) {
    options.push({
      channel: "whatsapp",
      label: "التواصل عبر واتساب أمان",
      href: whatsapp,
      note: "لا تُرسل هويات أو مستندات حساسة قبل توجيه فريق أمان لك.",
    });
  }

  if (phone) {
    options.push({
      channel: "phone",
      label: "الاتصال بشركة أمان",
      href: `tel:${phone}`,
      note: "التواصل الهاتفي بحسب ساعات العمل المعتمدة لدى أمان.",
    });
  }

  return [...options.filter((option) => option.channel === preference), ...options.filter((option) => option.channel !== preference)];
}

function getPolicyLinks(): AmanPolicyLink[] {
  const privacy =
    safePolicyUrl(process.env.AMAN_PRIVACY_URL) ?? safePolicyUrl(DEFAULT_PRIVACY_URL);
  const terms = safePolicyUrl(process.env.AMAN_TERMS_URL) ?? safePolicyUrl(DEFAULT_TERMS_URL);

  return [
    ...(privacy ? [{ label: "سياسة الخصوصية", href: privacy }] : []),
    ...(terms ? [{ label: "شروط الخدمة", href: terms }] : []),
  ];
}

export function buildAmanServiceCard(input: {
  legal_area: AmanLegalArea;
  urgency: AmanUrgency;
  contact_preference?: AmanContactChannel;
}): AmanServiceCard {
  const service = SERVICE_BY_AREA[input.legal_area];

  return {
    version: "1.0",
    legal_area: input.legal_area,
    legal_area_label: service.areaLabel,
    urgency: input.urgency,
    urgency_label: URGENCY_LABEL[input.urgency],
    service: {
      title: service.title,
      description: service.description,
      focus: service.focus,
      suggestedDocuments: service.suggestedDocuments,
      nextSteps: service.nextSteps,
    },
    recommended_steps: service.nextSteps,
    suggested_documents: service.suggestedDocuments,
    contact_options: getContactOptions(input.contact_preference),
    policy_links: getPolicyLinks(),
    privacy_notice:
      "لا تُرسل في ChatGPT أسماء الخصوم أو أرقام الهوية أو الآيبان أو أرقام القضايا أو المستندات الحساسة. لا ينشئ هذا الفرز طلبًا لدى أمان ولا يرسل بياناتك إليها.",
    legal_notice:
      "هذه بطاقة فرز معلوماتية وليست فتوى أو استشارة قانونية أو قبولًا للتمثيل. لا تنشأ علاقة محامٍ وعميل إلا بعد إبرامها صراحةً وفق إجراءات أمان.",
    hakeem_next_step:
      "للمعلومة القانونية العامة فقط، يمكن استخدام أدوات حكيم للبحث في الأنظمة والتحقق من الإحالات قبل التواصل مع المحامي.",
  };
}

export function getAmanConsultationLink(channel: AmanContactChannel) {
  const option = getContactOptions(channel).find((candidate) => candidate.channel === channel);

  if (option) return option;

  const fallback = getContactOptions("website")[0];
  if (fallback) return fallback;

  return {
    channel: "website" as const,
    label: "بوابة أمان غير مهيأة بعد",
    href: "https://amanlaws.com/",
    note: "يجب ضبط AMAN_CONSULTATION_URL قبل الإطلاق العام للتطبيق.",
  };
}

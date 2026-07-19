// قاموس الترجمة (عربي/إنجليزي) — أساس ثنائية اللغة وفق كود الحكومة الرقمية (DGA).
// المرحلة الأولى: هيكل التنقّل + عناصر الواجهة المشتركة. يتوسّع تدريجيًا.

export type Locale = "ar" | "en";

export const LOCALES: Locale[] = ["ar", "en"];
export const DEFAULT_LOCALE: Locale = "ar";
export const LOCALE_COOKIE = "hakeem_locale";

export const DIR: Record<Locale, "rtl" | "ltr"> = { ar: "rtl", en: "ltr" };
export const LOCALE_LABEL: Record<Locale, string> = { ar: "العربية", en: "English" };

type Dict = Record<string, string>;

const ar: Dict = {
  "brand.tagline": "منصة المحاكاة القضائية السعودية",
  "nav.home": "الرئيسية",
  "nav.search": "البحث الشامل",
  "nav.cases": "الدعاوى",
  "nav.consultations": "الاستشارات",
  "nav.attachments": "المرفقات",
  "nav.docPlatform": "منصة الوثائق",
  "nav.ask": "اسأل حكيم",
  "nav.judicialAssistant": "المعاون القضائيّ",
  "nav.interactiveJudge": "القاضي التفاعلي",
  "nav.simulation": "المحاكاة القضائية",
  "nav.quickAnalysis": "التحليل القضائي السريع",
  "nav.caseAnalysis": "تحليل القضايا",
  "nav.legalAgent": "الوكيل القانوني",
  "nav.legalCore": "النواة القانونية — المكتبة النظامية",
  "nav.library": "المكتبة النظامية",
  "nav.lab": "المختبر التجريبي",
  "nav.legalIssues": "المسائل القانونية",
  "nav.principles": "المبادئ القضائية",
  "nav.contentAdmin": "إدارة المحتوى",
  "nav.knowledgeGraph": "الرسم المعرفي (اختبار)",
  "nav.rag": "الذكاء القانوني RAG (اختبار)",
  "nav.training": "التدريب",
  "nav.settings": "الإعدادات",
  "nav.aiSettings": "إعدادات الذكاء",
  "nav.users": "المستخدمون",
  "nav.auditLog": "سجل التدقيق",
  "nav.tools": "أدوات متقدّمة",
  "nav.admin": "الإدارة",
  "nav.myFiles": "ملفّاتي",
  "topbar.searchPlaceholder": "بحث شامل في الأنظمة والمواد والأحكام...",
  "topbar.search": "بحث",
  "topbar.logout": "تسجيل الخروج",
  "a11y.skipToContent": "تخطٍّ إلى المحتوى الرئيسي",
  "a11y.mainNav": "التنقّل الرئيسي",
  "footer.tagline": "منصة حكيم — المعرفة القضائية السعودية",
  "footer.privacy": "سياسة الخصوصية",
  "footer.terms": "شروط الاستخدام",
  "lang.switch": "English",
  "lang.label": "اللغة",
};

const en: Dict = {
  "brand.tagline": "Saudi Judicial Simulation Platform",
  "nav.home": "Home",
  "nav.search": "Unified Search",
  "nav.cases": "Cases",
  "nav.consultations": "Consultations",
  "nav.attachments": "Attachments",
  "nav.docPlatform": "Documents Platform",
  "nav.ask": "Ask Hakeem",
  "nav.judicialAssistant": "Judicial Assistant",
  "nav.interactiveJudge": "Interactive Judge",
  "nav.simulation": "Judicial Simulation",
  "nav.quickAnalysis": "Quick Judicial Analysis",
  "nav.caseAnalysis": "Case Analysis",
  "nav.legalAgent": "Legal Agent",
  "nav.legalCore": "Legal Core — Statutory Library",
  "nav.library": "Statutory Library",
  "nav.lab": "Experimental Lab",
  "nav.legalIssues": "Legal Issues",
  "nav.principles": "Judicial Principles",
  "nav.contentAdmin": "Content Admin",
  "nav.knowledgeGraph": "Knowledge Graph (beta)",
  "nav.rag": "Legal RAG (beta)",
  "nav.training": "Training",
  "nav.settings": "Settings",
  "nav.aiSettings": "AI Settings",
  "nav.users": "Users",
  "nav.auditLog": "Audit Log",
  "nav.tools": "Advanced Tools",
  "nav.admin": "Administration",
  "nav.myFiles": "My Files",
  "topbar.searchPlaceholder": "Search statutes, articles and judgments...",
  "topbar.search": "Search",
  "topbar.logout": "Log out",
  "a11y.skipToContent": "Skip to main content",
  "a11y.mainNav": "Main navigation",
  "footer.tagline": "Hakeem — Saudi Judicial Knowledge",
  "footer.privacy": "Privacy Policy",
  "footer.terms": "Terms of Use",
  "lang.switch": "العربية",
  "lang.label": "Language",
};

const DICTS: Record<Locale, Dict> = { ar, en };

export function getDictionary(locale: Locale): Dict {
  return DICTS[locale] ?? ar;
}

/** ترجمة مفتاح؛ يعود للعربية ثم للمفتاح نفسه عند الغياب. */
export function translate(locale: Locale, key: string): string {
  return DICTS[locale]?.[key] ?? ar[key] ?? key;
}

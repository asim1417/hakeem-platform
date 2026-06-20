/**
 * saudi-systems.ts — أنواع ومُصنّف وتوصيف سكيمة جداول الأنظمة والمواد.
 *
 * يوثّق سكيمة `legal_systems` و`legal_articles` (المصدر: prisma/schema.prisma)، ويوفّر
 * أنواعاً للتصدير (saudi_systems.json) ومُصنّفاً شفّافاً للمجال القانوني من اسم النظام.
 * نقيّ وقابل لإعادة الاستخدام (يُستفاد منه لاحقاً في مستخرجات أنظمة أخرى).
 */
import { normalizeArabicText } from "./arabic-morphology";

// ── توصيف السكيمة (يُدرَج في التصدير للتوثيق) ──
export const SYSTEMS_SCHEMA = {
  legal_systems: {
    description: "الأنظمة القانونية السعودية (نظام/لائحة).",
    columns: {
      id: "String @id @default(cuid())",
      name: "String @unique — اسم النظام",
      classification: "String? — تصنيف النظام",
      articleCount: "Int @default(0) — عدد المواد",
      createdAt: "DateTime",
      updatedAt: "DateTime"
    },
    relations: { articles: "LegalArticle[] (1→N)" }
  },
  legal_articles: {
    description: "مواد الأنظمة.",
    columns: {
      id: "String @id @default(cuid())",
      legalSystemId: "String? → legal_systems.id",
      lawName: "String — اسم النظام (يطابق legal_systems.name)",
      classification: "String?",
      articleNumber: "Int — رقم المادة",
      title: "String — عنوان المادة",
      content: "String — نص المادة",
      chapter: "String? — الباب/الفصل",
      keywords: "String[] — وسوم",
      royalDecree: "String?",
      effectiveFrom: "DateTime?",
      status: 'String @default("سارية")'
    },
    uniques: ["(lawName, articleNumber)"],
    indexes: ["lawName"]
  }
} as const;

// ── أنواع التصدير ──
export interface SaudiArticle {
  articleNumber: number;
  title: string;
  content: string;
  chapter: string | null;
  keywords: string[];
  classification: string | null;
  status: string;
}

export interface SaudiSystem {
  name: string;
  /** ميسم المجال القانوني المُصنَّف (للربط بشجرة المسائل). */
  domain: string;
  domainTitle: string;
  classification: string | null;
  articleCount: number;
  articles: SaudiArticle[];
}

export interface SaudiSystemsExport {
  meta: {
    generatedAt: string;
    source: string;
    systemsCount: number;
    articlesCount: number;
    note: string;
  };
  schema: typeof SYSTEMS_SCHEMA;
  systems: SaudiSystem[];
}

// ── مُصنّف المجال القانوني من اسم النظام (شفّاف، مُرتَّب: الأخصّ أولاً) ──
export interface LegalDomain {
  slug: string;
  title: string;
}

const DOMAIN_RULES: { needles: string[]; domain: LegalDomain }[] = [
  { needles: ["احوال"], domain: { slug: "personal_status", title: "الأحوال الشخصية" } },
  { needles: ["معاملات مدنيه", "معاملات", "مدني"], domain: { slug: "civil", title: "المعاملات المدنية" } },
  { needles: ["شركات", "مساهمه"], domain: { slug: "companies", title: "الشركات" } },
  { needles: ["محاكم التجاريه", "تجاري", "تجاره"], domain: { slug: "commercial", title: "القضاء التجاري" } },
  { needles: ["ديوان المظالم", "اداري"], domain: { slug: "administrative", title: "القضاء الإداري" } },
  { needles: ["اجراءات الجزائيه", "جزائي", "جنائي", "عقوبات"], domain: { slug: "criminal", title: "الجزائي" } },
  { needles: ["مرافعات"], domain: { slug: "procedure", title: "المرافعات والإجراءات" } },
  { needles: ["تنفيذ"], domain: { slug: "enforcement", title: "التنفيذ" } },
  { needles: ["توثيق"], domain: { slug: "notarization", title: "التوثيق" } },
  { needles: ["عمل", "عمالي"], domain: { slug: "labor", title: "العمل" } },
  { needles: ["تحكيم"], domain: { slug: "arbitration", title: "التحكيم" } },
  { needles: ["افلاس"], domain: { slug: "bankruptcy", title: "الإفلاس" } }
];

const DOMAIN_FALLBACK: LegalDomain = { slug: "other", title: "أنظمة أخرى" };

/** يُصنّف النظام إلى مجال قانوني عبر مطابقة احتواء مُطبَّعة على اسمه. */
export function classifyDomain(systemName: string): LegalDomain {
  const n = normalizeArabicText(systemName || "");
  for (const rule of DOMAIN_RULES) {
    if (rule.needles.some((needle) => n.includes(normalizeArabicText(needle)))) return rule.domain;
  }
  return DOMAIN_FALLBACK;
}

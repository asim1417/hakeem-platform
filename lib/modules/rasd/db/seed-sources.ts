import { prisma } from "@/lib/prisma";
import type { RasdDocumentTypeCode, RasdSourceCode } from "../types";

export interface DefaultMonitoringSource {
  code: RasdSourceCode;
  nameAr: string;
  baseDomain: string;
  sourceRole: "PUBLICATION" | "CONSOLIDATED_TEXT" | "ARCHIVAL";
  trustPriority: number;
  supportsApi: boolean;
  supportsRss: boolean;
  supportsSitemap: boolean;
  crawlPolicy: string;
  rateLimitPerMinute: number;
}

export interface DefaultDocumentType {
  code: RasdDocumentTypeCode;
  nameAr: string;
  description: string;
  sortOrder: number;
}

export const DEFAULT_SOURCES: DefaultMonitoringSource[] = [
  {
    code: "UQN",
    nameAr: "جريدة أم القرى",
    baseDomain: "uqn.gov.sa",
    sourceRole: "PUBLICATION",
    trustPriority: 1,
    supportsApi: false,
    supportsRss: false,
    supportsSitemap: true,
    crawlPolicy: "Official gazette publication source. Avoid /ajax/ and page= crawl paths; prefer sitemap and stable detail pages.",
    rateLimitPerMinute: 20
  },
  {
    code: "BOE",
    nameAr: "هيئة الخبراء بمجلس الوزراء",
    baseDomain: "laws.boe.gov.sa",
    sourceRole: "CONSOLIDATED_TEXT",
    trustPriority: 2,
    supportsApi: false,
    supportsRss: false,
    supportsSitemap: false,
    crawlPolicy: "Consolidated legal texts through LawsHome/LawDetails. Use review workflow before applying changes.",
    rateLimitPerMinute: 15
  },
  {
    code: "NCAR",
    nameAr: "المركز الوطني للوثائق والمحفوظات",
    baseDomain: "ncar.gov.sa",
    sourceRole: "ARCHIVAL",
    trustPriority: 3,
    supportsApi: false,
    supportsRss: false,
    supportsSitemap: false,
    crawlPolicy: "Archival metadata, related documents, and Umm Al-Qura issue linkage. Never auto-resolve conflicts against BOE/UQN.",
    rateLimitPerMinute: 15
  }
];

export const DEFAULT_DOCUMENT_TYPES: DefaultDocumentType[] = [
  { code: "LAW", nameAr: "نظام", description: "أنظمة صادرة بأداة نظامية عليا", sortOrder: 10 },
  { code: "REGULATION", nameAr: "لائحة", description: "لوائح تنظيمية أو تنفيذية", sortOrder: 20 },
  { code: "IMPLEMENTING_REGULATION", nameAr: "لائحة تنفيذية", description: "لائحة تنفيذية لنظام قائم", sortOrder: 30 },
  { code: "ROYAL_DECREE", nameAr: "مرسوم ملكي", description: "أداة إصدار أو تعديل نظامية", sortOrder: 40 },
  { code: "CABINET_DECISION", nameAr: "قرار مجلس الوزراء", description: "قرارات مجلس الوزراء ذات الأثر التشريعي", sortOrder: 50 },
  { code: "MINISTERIAL_DECISION", nameAr: "قرار وزاري", description: "قرارات وزارية تنظيمية", sortOrder: 60 },
  { code: "CIRCULAR", nameAr: "تعميم", description: "تعاميم رسمية ذات أثر تنظيمي", sortOrder: 70 },
  { code: "RULES", nameAr: "قواعد", description: "قواعد وإجراءات تنظيمية", sortOrder: 80 },
  { code: "GUIDE", nameAr: "دليل", description: "أدلة تنظيمية أو إجرائية", sortOrder: 90 },
  { code: "OTHER", nameAr: "أخرى", description: "نوع غير مصنف يحتاج مراجعة", sortOrder: 100 }
];

interface MonitoringSourceUpsertArgs {
  where: { code: RasdSourceCode };
  create: DefaultMonitoringSource & { metadata: { seededBy: string } };
  update: Omit<DefaultMonitoringSource, "code"> & { isActive: boolean };
}

interface RasdDocumentTypeUpsertArgs {
  where: { code: RasdDocumentTypeCode };
  create: DefaultDocumentType;
  update: Omit<DefaultDocumentType, "code"> & { isActive: boolean };
}

interface MonitoringSourceDelegate {
  upsert(args: MonitoringSourceUpsertArgs): Promise<unknown>;
}

interface RasdDocumentTypeDelegate {
  upsert(args: RasdDocumentTypeUpsertArgs): Promise<unknown>;
}

function rasdDelegates(): {
  monitoringSource?: MonitoringSourceDelegate;
  rasdDocumentType?: RasdDocumentTypeDelegate;
} {
  return prisma as unknown as {
    monitoringSource?: MonitoringSourceDelegate;
    rasdDocumentType?: RasdDocumentTypeDelegate;
  };
}

export async function seedRasdRegistry(): Promise<{ sources: number; documentTypes: number }> {
  let sources = 0;
  let documentTypes = 0;
  const delegates = rasdDelegates();
  if (!delegates.monitoringSource || !delegates.rasdDocumentType) {
    throw new Error("Rasd Prisma delegates are unavailable. Run prisma generate after applying Rasd schema migrations.");
  }

  for (const source of DEFAULT_SOURCES) {
    await delegates.monitoringSource.upsert({
      where: { code: source.code },
      create: {
        code: source.code,
        nameAr: source.nameAr,
        baseDomain: source.baseDomain,
        sourceRole: source.sourceRole,
        trustPriority: source.trustPriority,
        supportsApi: source.supportsApi,
        supportsRss: source.supportsRss,
        supportsSitemap: source.supportsSitemap,
        crawlPolicy: source.crawlPolicy,
        rateLimitPerMinute: source.rateLimitPerMinute,
        metadata: { seededBy: "rasd-core" }
      },
      update: {
        nameAr: source.nameAr,
        baseDomain: source.baseDomain,
        sourceRole: source.sourceRole,
        trustPriority: source.trustPriority,
        supportsApi: source.supportsApi,
        supportsRss: source.supportsRss,
        supportsSitemap: source.supportsSitemap,
        crawlPolicy: source.crawlPolicy,
        rateLimitPerMinute: source.rateLimitPerMinute,
        isActive: true
      }
    });
    sources += 1;
  }

  for (const docType of DEFAULT_DOCUMENT_TYPES) {
    await delegates.rasdDocumentType.upsert({
      where: { code: docType.code },
      create: {
        code: docType.code,
        nameAr: docType.nameAr,
        description: docType.description,
        sortOrder: docType.sortOrder
      },
      update: {
        nameAr: docType.nameAr,
        description: docType.description,
        sortOrder: docType.sortOrder,
        isActive: true
      }
    });
    documentTypes += 1;
  }

  return { sources, documentTypes };
}

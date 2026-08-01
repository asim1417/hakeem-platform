import "server-only";

import { prisma } from "@/lib/prisma";

export type PublicPlatformStats = {
  legalSystems: number;
  legalArticles: number;
  judgments: number;
  principles: number;
};

/**
 * مؤشرات عامة آمنة من قاعدة حكيم الحية.
 * لا تعرض بيانات مستخدمين أو نشاطًا داخليًا، ولا تستخدم أرقامًا تسويقية ثابتة.
 */
export async function getPublicPlatformStats(): Promise<PublicPlatformStats> {
  const [legalSystems, legalArticles, judgments, principles] = await Promise.all([
    prisma.legalSystem.count().catch(() => 0),
    prisma.legalArticle.count().catch(() => 0),
    prisma.judicialCase.count().catch(() => 0),
    prisma.judicialPrinciple.count().catch(() => 0),
  ]);

  return {
    legalSystems,
    legalArticles,
    judgments,
    principles,
  };
}

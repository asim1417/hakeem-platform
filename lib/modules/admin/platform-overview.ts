/**
 * نظرة عامة حقيقية للمنصة — عدّادات من القاعدة بلا بيانات وهمية.
 */
import "server-only";

import { prisma } from "@/lib/prisma";
import { getAiStatus } from "@/lib/modules/ai/ai-config";
import { sharePointConfigured, storageBackend } from "@/lib/modules/attachments/blob-storage";
import { isGoogleOAuthConfigured } from "@/lib/modules/auth/google-oauth";
import { isMicrosoftOAuthConfigured } from "@/lib/modules/auth/microsoft-oauth";
import { isClerkConfigured } from "@/lib/modules/auth/clerk-config";
import { listJobStats, listRecentJobs } from "@/lib/modules/jobs/job-store";
import { TRADITIONAL_SEARCH_ENABLED } from "@/lib/modules/config/search-visibility";
import { listFeatureToggles } from "@/lib/modules/admin/feature-toggles";

export async function getPlatformOverview() {
  const database = await prisma.$queryRaw`SELECT 1`
    .then(() => "متصلة" as const)
    .catch(() => "تعذر الاتصال" as const);

  const [
    usersTotal,
    usersActive,
    usersByRole,
    legalSystems,
    legalArticles,
    judgments,
    principles,
    auditLogs,
    attachments,
    cases,
    consultations,
    simulations,
    featureToggles,
    jobStats,
    recentJobs,
    recentAudit,
    ai,
  ] = await Promise.all([
    prisma.user.count().catch(() => 0),
    prisma.user.count({ where: { isActive: true } }).catch(() => 0),
    prisma.user
      .groupBy({ by: ["role"], _count: { _all: true } })
      .catch(() => [] as Array<{ role: string; _count: { _all: number } }>),
    prisma.legalSystem.count().catch(() => 0),
    prisma.legalArticle.count().catch(() => 0),
    prisma.judicialCase.count().catch(() => 0),
    prisma.judicialPrinciple.count().catch(() => 0),
    prisma.auditEvent.count().catch(() => 0),
    prisma.attachment.count().catch(() => 0),
    prisma.caseFile.count().catch(() => 0),
    prisma.consultation.count().catch(() => 0),
    prisma.simulation.count().catch(() => 0),
    listFeatureToggles().catch(() => []),
    listJobStats().catch(() => ({ total: 0, running: 0, done: 0, error: 0, cancelled: 0 })),
    listRecentJobs(12).catch(() => []),
    prisma.auditEvent
      .findMany({
        orderBy: { createdAt: "desc" },
        take: 12,
        select: {
          id: true,
          subject: true,
          action: true,
          entityId: true,
          createdAt: true,
          actor: { select: { name: true, email: true } },
        },
      })
      .catch(() => []),
    getAiStatus().catch(() => null),
  ]);

  const roleCounts = Object.fromEntries(
    (usersByRole as Array<{ role: string; _count: { _all: number } }>).map((r) => [r.role, r._count._all])
  );

  return {
    database,
    auth: {
      clerk: isClerkConfigured(),
      google: isGoogleOAuthConfigured(),
      microsoft: isMicrosoftOAuthConfigured(),
    },
    ai: {
      live: Boolean(ai && ai.provider !== "offline" && ai.configured),
      provider: ai?.provider ?? "offline",
    },
    storage: storageBackend(),
    sharePoint: sharePointConfigured(),
    traditionalSearchUi: TRADITIONAL_SEARCH_ENABLED,
    counts: {
      usersTotal,
      usersActive,
      roleCounts,
      legalSystems,
      legalArticles,
      judgments,
      principles,
      auditLogs,
      attachments,
      cases,
      consultations,
      simulations,
    },
    jobs: jobStats,
    recentJobs,
    recentAudit,
    featureToggles,
  };
}

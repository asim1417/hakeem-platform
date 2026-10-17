// مدخل legalMetricsService في الخادم: يربط الخدمة النقية (metrics.ts) بـ Prisma وبملف فهرس المسائل.
// كل صفحة فيها عدّاد قانوني تستدعي getLegalMetrics من هنا، ولا تعدّ بنفسها.
import { prisma } from "@/lib/prisma";
import { relationTypeLabel } from "@/lib/i18n/enum-labels";
import { legalIssuesCounts } from "./legal-issues";
import {
  listPrinciples,
  loadLegalMetrics,
  METRIC_GROUPS,
  principleCourts,
  type LegalMetricsSnapshot,
  type MetricGroup,
  type MetricsSql,
  type PrincipleFilters,
} from "./metrics";

/** منفذ SQL للقراءة عبر Prisma (معاملات مرقّمة، لا دمج نصوص). */
export function prismaMetricsSql(): MetricsSql {
  return {
    query: async <T>(sql: string, params: readonly unknown[] = []) => (await prisma.$queryRawUnsafe<T[]>(sql, ...params)) as T[],
  };
}

/** لقطة المجموعات المطلوبة فقط. الصفحة تحمّلها مرة وتمرّرها لمكوّناتها (لا عدّ ثانٍ). */
export function getLegalMetrics(groups: readonly MetricGroup[] = METRIC_GROUPS): Promise<LegalMetricsSnapshot> {
  return loadLegalMetrics(prismaMetricsSql(), {
    groups: METRIC_GROUPS.filter((g) => groups.includes(g)),
    legalIssues: legalIssuesCounts,
    relationLabel: relationTypeLabel,
  });
}

export function getPrincipleQueue(filters: PrincipleFilters) {
  return listPrinciples(prismaMetricsSql(), filters);
}

export function getPrincipleCourts() {
  return principleCourts(prismaMetricsSql());
}

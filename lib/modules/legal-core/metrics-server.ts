// مدخل legalMetricsService في الخادم: يربط الخدمة النقية (metrics.ts) بـ Prisma وبملف فهرس المسائل.
// كل صفحة فيها عدّاد قانوني تستدعي getLegalMetrics من هنا، ولا تعدّ بنفسها.
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { LEGAL_CORE_CACHE_TAG } from "@/lib/modules/library/library-service";
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

/**
 * للصفحات العامة التي يزورها المحامون (الرئيسية، المسائل، قائمة الأحكام، مركز التشغيل الذكي):
 * اللقطة مخزنة 600 ثانية بوسم LEGAL_CORE_CACHE_TAG كما كانت أعدادها قبل م١، فلا تُشغَّل الاستعلامات في كل عرض.
 * صفحات الإدارة (الجودة، التغطية، المبادئ، /admin/legal) تبقى حية عبر getLegalMetrics.
 */
const cachedSnapshot = unstable_cache(
  (key: string) => getLegalMetrics(key.split(",").filter(Boolean) as MetricGroup[]),
  ["legal-core:metrics-snapshot"],
  { revalidate: 600, tags: [LEGAL_CORE_CACHE_TAG] },
);

export function getLegalMetricsCached(groups: readonly MetricGroup[] = METRIC_GROUPS): Promise<LegalMetricsSnapshot> {
  return cachedSnapshot(METRIC_GROUPS.filter((g) => groups.includes(g)).join(","));
}

export function getPrincipleQueue(filters: PrincipleFilters) {
  return listPrinciples(prismaMetricsSql(), filters);
}

export function getPrincipleCourts() {
  return principleCourts(prismaMetricsSql());
}

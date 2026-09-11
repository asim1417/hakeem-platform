import { prisma } from "@/lib/prisma";
import type {
  DataSourceDefinition,
  DueDiligenceConnector,
  EntityQuery,
  RawObservation,
  SourceRunResult,
} from "./core";

export const HAKEEM_PUBLISHED_JUDGMENTS_SOURCE: DataSourceDefinition = {
  key: "hakeem_published_judgments",
  nameAr: "الأحكام القضائية المنشورة",
  authority: "وزارة العدل — الأحكام المنشورة المحفوظة في قاعدة حكيم",
  accessType: "PUBLIC_WEB",
  status: "APPROVED",
  reliability: 0.95,
  baseUrl: "https://www.moj.gov.sa",
};

function compactText(value: string | null | undefined, max = 360): string | undefined {
  const normalized = value?.replace(/\s+/g, " ").trim();
  if (!normalized) return undefined;
  return normalized.length > max ? `${normalized.slice(0, max - 1)}…` : normalized;
}

function safeOfficialSourceLink(value: string | null | undefined): string {
  if (value) {
    try {
      const url = new URL(value);
      if (url.protocol === "https:" && (url.hostname === "moj.gov.sa" || url.hostname.endsWith(".moj.gov.sa"))) {
        return url.toString();
      }
    } catch {
      // Fall through to the official ministry landing page.
    }
  }
  return "https://www.moj.gov.sa/";
}

/**
 * Searches Hakim's local corpus of publicly published Saudi judgments.
 *
 * Safety rule: a lexical mention of an entity name is discovery evidence only.
 * We intentionally do not manufacture a commercial-registration/unified-number
 * match from judgment text, so these observations normally remain NEEDS_REVIEW
 * until a stronger identifier or human review confirms party identity.
 */
export class HakeemPublishedJudgmentsConnector implements DueDiligenceConnector {
  public readonly source = HAKEEM_PUBLISHED_JUDGMENTS_SOURCE;

  async collect(query: EntityQuery): Promise<SourceRunResult> {
    const startedAt = Date.now();
    const entityName = query.name.trim();
    if (entityName.length < 3) {
      return {
        source: this.source,
        observations: [],
        warnings: ["اسم الكيان قصير جدًا للبحث الآمن في الأحكام المنشورة."],
        durationMs: Date.now() - startedAt,
      };
    }

    const rows = await prisma.judicialCase.findMany({
      where: {
        source: { in: ["ahkam_moj", "moj", "ministry_of_justice"] },
        OR: [
          { judgmentTitle: { contains: entityName, mode: "insensitive" } },
          { judgmentText: { contains: entityName, mode: "insensitive" } },
          { appealText: { contains: entityName, mode: "insensitive" } },
        ],
      },
      orderBy: [{ decisionDate: "desc" }, { createdAt: "desc" }],
      take: 25,
      select: {
        id: true,
        sourceId: true,
        decisionNo: true,
        caseNo: true,
        court: true,
        cityName: true,
        decisionDateText: true,
        decisionDate: true,
        judgmentTitle: true,
        sourceLink: true,
        reviewStatus: true,
      },
    });

    const fetchedAt = new Date().toISOString();
    const observations: RawObservation[] = rows.map((row) => ({
      sourceKey: this.source.key,
      sourceRecordId: row.sourceId ? String(row.sourceId) : row.id,
      // The search hit confirms only that this name appears in a published ruling.
      // Keeping entityName equal to the query yields a lexical confidence signal,
      // but without CR/unified-number it cannot reach VERIFIED/MATCHED thresholds.
      entityName,
      city: row.cityName ?? undefined,
      category: "published_judgment_mention",
      title:
        compactText(row.judgmentTitle, 180) ??
        `حكم منشور${row.caseNo ? ` — القضية ${row.caseNo}` : row.decisionNo ? ` — القرار ${row.decisionNo}` : ""}`,
      summary: compactText(
        [
          row.court ? `المحكمة: ${row.court}` : null,
          row.caseNo ? `رقم القضية: ${row.caseNo}` : null,
          row.decisionNo ? `رقم القرار: ${row.decisionNo}` : null,
          row.decisionDateText ? `التاريخ: ${row.decisionDateText}` : null,
          row.reviewStatus ? `حالة المراجعة في حكيم: ${row.reviewStatus}` : null,
        ]
          .filter(Boolean)
          .join(" — "),
        420
      ),
      sourceUrl: safeOfficialSourceLink(row.sourceLink),
      occurredAt: row.decisionDate?.toISOString() ?? undefined,
      fetchedAt,
      raw: {
        id: row.id,
        sourceId: row.sourceId,
        caseNo: row.caseNo,
        decisionNo: row.decisionNo,
        court: row.court,
        cityName: row.cityName,
        decisionDateText: row.decisionDateText,
        reviewStatus: row.reviewStatus,
      },
    }));

    const warnings = [
      "نتائج الأحكام هنا هي إشارات بحث بالاسم في أحكام منشورة؛ لا تُعدّ إثباتًا بأن الكيان طرف في الحكم دون تحقق إضافي.",
      "لا تؤثر هذه الإشارات وحدها في درجة المخاطر، وتُعرض للمراجعة البشرية وربط الهوية.",
    ];
    if (rows.length === 25) {
      warnings.push("أُعيد أول 25 تطابقًا فقط؛ قد توجد نتائج إضافية ويجب توسيع الفحص عند الحاجة.");
    }

    return {
      source: this.source,
      observations,
      warnings,
      durationMs: Date.now() - startedAt,
    };
  }
}

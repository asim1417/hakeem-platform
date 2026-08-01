import "server-only";

// إسقاط موحّد لكائن المعرفة — المخطط السيادي §7، **بلا هجرة**.
// يقرأ الجداول القائمة ويعرضها بالشكل الموحّد (id/uri/type/status/provenance...) عند
// القراءة فقط — تقارب تدريجيّ لا يمسّ المخطط. التوحيد الفيزيائيّ يبقى قرارًا لاحقًا (ADR).

import { prisma } from "@/lib/prisma";
import { buildUri, parseUri, type KnowledgeEntityType } from "./uri";
import { buildProvenance, type Provenance } from "./provenance";

export interface KnowledgeObject {
  id: string;
  uri: string;
  type: KnowledgeEntityType;
  title: string;
  status: string;
  provenance: Provenance;
  metadata: Record<string, unknown>;
}

/** يحوّل مادّة نظاميّة إلى الشكل الموحّد. */
function fromArticle(a: { id: string; title: string; lawName: string; articleNumber: number; status: string; royalDecree: string | null }): KnowledgeObject {
  return {
    id: a.id,
    uri: buildUri("article", a.id),
    type: "article",
    title: a.title || `${a.lawName} — مادة ${a.articleNumber}`,
    status: a.status,
    provenance: buildProvenance({ source: a.royalDecree ? "royal-decree" : "library", verification: "verified" }),
    metadata: { lawName: a.lawName, articleNumber: a.articleNumber },
  };
}

/** يحلّ URI سياديًّا إلى كائن معرفة موحّد بقراءة الجدول المناسب. دفاعيّ (null عند التعذّر). */
export async function getKnowledgeObject(uri: string): Promise<KnowledgeObject | null> {
  const parsed = parseUri(uri);
  if (!parsed) return null;
  try {
    switch (parsed.type) {
      case "article": {
        const a = await prisma.legalArticle.findUnique({ where: { id: parsed.id } });
        return a ? fromArticle(a) : null;
      }
      case "case": {
        const c = await prisma.caseFile.findUnique({ where: { id: parsed.id } });
        return c
          ? {
              id: c.id,
              uri,
              type: "case",
              title: c.title,
              status: c.status,
              provenance: buildProvenance({ source: "user", verification: "unverified" }),
              metadata: { ownerId: c.ownerId },
            }
          : null;
      }
      case "review_session": {
        const s = await prisma.reviewSession.findUnique({ where: { id: parsed.id } });
        return s
          ? {
              id: s.id,
              uri,
              type: "review_session",
              title: s.title,
              status: s.status,
              provenance: buildProvenance({ source: "review", verification: "unverified" }),
              metadata: { entityType: s.entityType, ownerId: s.ownerId },
            }
          : null;
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
}

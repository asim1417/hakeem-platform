import { prisma } from "@/lib/prisma";
import type { LegalRelation, RelationType } from "@prisma/client";

// أنواع الكيانات في الرسم المعرفي — تُحَلّ إلى النماذج القائمة.
export const ENTITY_TYPES = ["article", "ruling", "principle", "system"] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export const RELATION_TYPES: RelationType[] = [
  "SUPPORTS",
  "CONTRADICTS",
  "INTERPRETS",
  "IMPLEMENTS",
  "SUPERSEDES",
  "RELATED_TO",
];

export interface CreateRelationInput {
  sourceType: EntityType;
  sourceId: string;
  targetType: EntityType;
  targetId: string;
  relation: RelationType;
  strength?: number;
  description?: string;
}

export interface ResolvedEntity {
  type: EntityType;
  id: string;
  label: string;
  exists: boolean;
}

/** ينشئ علاقة في الرسم المعرفي القانوني. */
export async function createRelation(input: CreateRelationInput): Promise<LegalRelation> {
  return prisma.legalRelation.create({
    data: {
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      targetType: input.targetType,
      targetId: input.targetId,
      relation: input.relation,
      strength: input.strength ?? 1.0,
      description: input.description ?? null,
    },
  });
}

/** يسرد العلاقات مع تصفية اختيارية. */
export async function listRelations(opts?: {
  relation?: RelationType;
  limit?: number;
}): Promise<LegalRelation[]> {
  return prisma.legalRelation.findMany({
    where: opts?.relation ? { relation: opts.relation } : undefined,
    orderBy: { createdAt: "desc" },
    take: Math.min(opts?.limit ?? 50, 200),
  });
}

/** كل العلاقات التي يظهر فيها الكيان مصدراً أو هدفاً. */
export async function getRelationsForEntity(type: EntityType, id: string): Promise<LegalRelation[]> {
  return prisma.legalRelation.findMany({
    where: {
      OR: [
        { sourceType: type, sourceId: id },
        { targetType: type, targetId: id },
      ],
    },
    orderBy: { createdAt: "desc" },
  });
}

/** يحلّ (نوع، معرّف) إلى الكيان القائم مع عنوان مقروء — يربط الرسم بالنماذج الحالية. */
export async function resolveEntity(type: EntityType, id: string): Promise<ResolvedEntity> {
  try {
    if (type === "article") {
      const a = await prisma.legalArticle.findUnique({
        where: { id },
        select: { lawName: true, articleNumber: true, title: true },
      });
      if (a) return { type, id, exists: true, label: `${a.lawName} — م/${a.articleNumber}: ${a.title}` };
    } else if (type === "ruling") {
      const r = await prisma.judicialCase.findUnique({
        where: { id },
        select: { caseNo: true, decisionNo: true, court: true },
      });
      if (r) return { type, id, exists: true, label: `حكم ${r.decisionNo ?? r.caseNo ?? id}${r.court ? ` — ${r.court}` : ""}` };
    } else if (type === "principle") {
      const p = await prisma.judicialPrinciple.findUnique({ where: { id }, select: { title: true } });
      if (p) return { type, id, exists: true, label: `مبدأ: ${p.title}` };
    } else if (type === "system") {
      const s = await prisma.legalSystem.findUnique({ where: { id }, select: { name: true } });
      if (s) return { type, id, exists: true, label: s.name };
    }
  } catch {
    /* تجاهل وأعد كيانًا غير محلول */
  }
  return { type, id, exists: false, label: `${type}:${id} (غير موجود)` };
}

export interface HydratedRelation {
  id: string;
  relation: RelationType;
  strength: number;
  description: string | null;
  createdAt: string;
  source: ResolvedEntity;
  target: ResolvedEntity;
}

/** يُثري قائمة علاقات بالكيانات المُحلّلة (المصدر والهدف). */
export async function hydrateRelations(relations: LegalRelation[]): Promise<HydratedRelation[]> {
  return Promise.all(
    relations.map(async (r) => ({
      id: r.id,
      relation: r.relation,
      strength: r.strength,
      description: r.description,
      createdAt: r.createdAt.toISOString(),
      source: await resolveEntity(r.sourceType as EntityType, r.sourceId),
      target: await resolveEntity(r.targetType as EntityType, r.targetId),
    }))
  );
}

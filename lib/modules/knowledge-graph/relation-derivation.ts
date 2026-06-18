// اشتقاق علاقات الرسم المعرفي من الروابط القائمة (دوال نقيّة قابلة للاختبار).
// لا تلمس القاعدة — تحوّل بيانات الروابط/المبادئ إلى مواصفات علاقات legal_relations.
import type { RelationType } from "@prisma/client";

export interface RelationSpec {
  sourceType: "article" | "ruling" | "principle";
  sourceId: string;
  targetType: "article" | "ruling" | "principle";
  targetId: string;
  relation: RelationType;
  strength: number;
  description?: string;
}

const KEYWORD_RELATION: { keys: string[]; relation: RelationType }[] = [
  { keys: ["سند", "basis", "support", "تأييد", "استناد"], relation: "SUPPORTS" },
  { keys: ["تفسير", "interpret", "تأويل", "بيان"], relation: "INTERPRETS" },
  { keys: ["تعارض", "مخالف", "contradict", "نقض"], relation: "CONTRADICTS" },
  { keys: ["تطبيق", "implement", "إعمال"], relation: "IMPLEMENTS" },
  { keys: ["إلغاء", "نسخ", "supersede", "supersession"], relation: "SUPERSEDES" },
];

/** يحوّل نوع الربط النصّي (LegalArticleCaseLink.relationType) إلى نوع علاقة معياري. */
export function mapLinkRelationType(raw: string | null | undefined): RelationType {
  const t = (raw ?? "").toLowerCase();
  if (!t) return "RELATED_TO";
  for (const rule of KEYWORD_RELATION) {
    if (rule.keys.some((k) => t.includes(k.toLowerCase()))) return rule.relation;
  }
  return "RELATED_TO";
}

export function clampStrength(value: number | null | undefined): number {
  if (typeof value !== "number" || Number.isNaN(value)) return 0.7;
  return Math.max(0, Math.min(1, value));
}

export interface ArticleCaseLinkInput {
  articleId: string;
  caseId: string;
  relationType: string | null;
  confidence: number | null;
}
export interface PrincipleInput {
  id: string;
  sourceCaseId: string;
  confidence: number | null;
}

/** علاقة مادة↔حكم من رابط قائم. */
export function relationFromArticleCaseLink(link: ArticleCaseLinkInput): RelationSpec {
  return {
    sourceType: "article",
    sourceId: link.articleId,
    targetType: "ruling",
    targetId: link.caseId,
    relation: mapLinkRelationType(link.relationType),
    strength: clampStrength(link.confidence),
    description: link.relationType ?? undefined,
  };
}

/** علاقة حكم↔مبدأ من مبدأ مستخلَص من الحكم. */
export function relationFromPrinciple(principle: PrincipleInput): RelationSpec {
  return {
    sourceType: "ruling",
    sourceId: principle.sourceCaseId,
    targetType: "principle",
    targetId: principle.id,
    relation: "INTERPRETS",
    strength: clampStrength(principle.confidence ?? 0.8),
  };
}

/** مفتاح تفرّد لمنع تكرار العلاقات (idempotency). */
export function relationKey(spec: RelationSpec): string {
  return `${spec.sourceType}:${spec.sourceId}>${spec.relation}>${spec.targetType}:${spec.targetId}`;
}

/** يبني خطة العلاقات من الروابط والمبادئ، بلا تكرار. */
export function planRelations(links: ArticleCaseLinkInput[], principles: PrincipleInput[]): RelationSpec[] {
  const seen = new Set<string>();
  const out: RelationSpec[] = [];
  for (const link of links) {
    const spec = relationFromArticleCaseLink(link);
    const key = relationKey(spec);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(spec);
    }
  }
  for (const p of principles) {
    const spec = relationFromPrinciple(p);
    const key = relationKey(spec);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(spec);
    }
  }
  return out;
}

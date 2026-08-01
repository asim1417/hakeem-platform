// الهوية السيادية الموحّدة — المخطط السيادي §7. نواة نقيّة بلا مخطط قاعدة بيانات.
// معرّف عابر للكيانات: platform://<type>/<id> — يوحّد الإشارة دون هجرة (تقارب تدريجيّ).

export const PLATFORM_URI_SCHEME = "platform";

/** أنواع الكيانات المعروفة — تُوسَّع دون كسر. */
export const KNOWLEDGE_ENTITY_TYPES = [
  "system",
  "article",
  "ruling",
  "principle",
  "case",
  "consultation",
  "document",
  "attachment",
  "review_session",
  "finding",
  "suggestion",
  "relation",
  "package",
  "workflow",
] as const;

export type KnowledgeEntityType = (typeof KNOWLEDGE_ENTITY_TYPES)[number];

/** يبني معرّفًا سياديًّا: platform://article/abc123 */
export function buildUri(type: KnowledgeEntityType, id: string): string {
  return `${PLATFORM_URI_SCHEME}://${type}/${id}`;
}

export interface ParsedUri {
  scheme: string;
  type: KnowledgeEntityType;
  id: string;
}

/** يحلّل معرّفًا سياديًّا؛ يعيد null إن لم يطابق الصيغة أو النوع غير معروف. */
export function parseUri(uri: string): ParsedUri | null {
  const m = /^([a-z]+):\/\/([a-z_]+)\/(.+)$/.exec(uri.trim());
  if (!m) return null;
  const [, scheme, type, id] = m;
  if (scheme !== PLATFORM_URI_SCHEME) return null;
  if (!(KNOWLEDGE_ENTITY_TYPES as readonly string[]).includes(type)) return null;
  if (!id) return null;
  return { scheme, type: type as KnowledgeEntityType, id };
}

export function isKnowledgeEntityType(t: string): t is KnowledgeEntityType {
  return (KNOWLEDGE_ENTITY_TYPES as readonly string[]).includes(t);
}

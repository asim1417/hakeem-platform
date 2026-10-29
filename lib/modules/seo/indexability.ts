/**
 * HKM-061: قابلية فهرسة صفحة النظام (/legal/[slug]) — مصدر واحد لـ noindex ولـ sitemap.
 *
 * الصفحة تُفهرس إن كان للنظام مواد، أو كان «نص النظام» المعروض فيها محتوى حقيقيًا بطول
 * MIN_INDEXABLE_SYSTEM_TEXT_CHARS فأكثر بعد التشذيب. «نص النظام» هو ما ترسمه الصفحة فعلًا:
 * كتل بطاقة المصدر (law_card.text_blocks، آخر بطاقة) إن وُجدت، وإلا ديباجة النظام (legal_systems.preamble).
 * ما دون ذلك (مثل «نص غير متاح» أو سطر أداة الإصدار وحده) صفحة رقيقة: noindex, follow، وخارج sitemap،
 * وتبقى 200 (لا 404) حتى يُملأ محتواها.
 */
import type { Metadata } from "next";

/** أقل عدد محارف (نقاط يونيكود بعد التشذيب) لنص نظام بلا مواد حتى تُفهرس صفحته. */
export const MIN_INDEXABLE_SYSTEM_TEXT_CHARS = 500;

/**
 * فئة المسافات الطرفية المشذّبة — نفس النص يُستعمل نمطًا في JS وفي PostgreSQL (regexp_replace)،
 * فيتطابق العدّ في الصفحة وفي sitemap. تطابق مجموعة String.prototype.trim في JS.
 */
const EDGE_SPACE_CLASS = "[\\t\\n\\v\\f\\r \\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000\\ufeff]";

/** نمط التشذيب (طرفا النص) — يُمرَّر معاملًا لـ regexp_replace(text, pattern, '', 'g'). */
export const EDGE_SPACE_PATTERN = `^${EDGE_SPACE_CLASS}+|${EDGE_SPACE_CLASS}+$`;

const EDGE_SPACE_RE = new RegExp(EDGE_SPACE_PATTERN, "g");

/** عدد المحارف بعد التشذيب، بنقاط يونيكود (كـ char_length في PostgreSQL). */
export function trimmedCharCount(text: string | null | undefined): number {
  if (!text) return 0;
  return Array.from(text.replace(EDGE_SPACE_RE, "")).length;
}

/** طول «نص النظام» المعروض: كتل البطاقة إن وُجدت (ولو قصيرة)، وإلا الديباجة — كمنطق صفحة النظام. */
export function systemTextChars(input: {
  cardBlocks?: ReadonlyArray<{ text?: unknown }> | null;
  preamble?: string | null;
}): number {
  const blocks = input.cardBlocks ?? [];
  if (blocks.length > 0) {
    return blocks.reduce((n, b) => n + trimmedCharCount(typeof b?.text === "string" ? b.text : ""), 0);
  }
  return trimmedCharCount(input.preamble);
}

export interface SystemContentSignal {
  /** عدد المواد المعروضة (رقم > 0 ودرجة «مكرر» < 100). يكفي 0 أو 1 للحكم. */
  articleCount: number;
  /** طول «نص النظام» المعروض بعد التشذيب (systemTextChars). */
  textChars: number;
}

export function isSystemIndexable(signal: SystemContentSignal): boolean {
  return signal.articleCount > 0 || signal.textChars >= MIN_INDEXABLE_SYSTEM_TEXT_CHARS;
}

/** robots لصفحة النظام. null = تعذّر القياس (خطأ قاعدة): لا noindex، فلا يُسقط عطلٌ عابر صفحةً من الفهرس. */
export function systemPageRobots(signal: SystemContentSignal | null): Metadata["robots"] | undefined {
  if (!signal) return undefined;
  return isSystemIndexable(signal) ? undefined : { index: false, follow: true };
}

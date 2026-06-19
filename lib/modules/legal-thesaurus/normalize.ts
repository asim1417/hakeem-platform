/**
 * normalize.ts — معالجة نصوص المواد للمكنز (نقيّة، بلا قاعدة). تُفرّق بين:
 *  - normalizedText: توحيد حروف + إزالة تشكيل/تطويل (يحفظ الياء/الألف المقصورة).
 *  - searchableText: صيغة بحث (تطوي الياء/المقصورة والتاء المربوطة) للمطابقة.
 * كما تقسّم النص إلى جمل وفقرات، وتولّد hash ثابتاً (sha256) لمنع إعادة المعالجة.
 */
import { createHash } from "node:crypto";

const TASHKEEL = /[ً-ْٰ]/g; // الحركات + الخنجرية
const TATWEEL = /ـ/g;

/** توحيد لطيف: إزالة التشكيل/التطويل + توحيد الألف + تنظيف المسافات (يحفظ ى/ي/ة). */
export function normalizeText(input: string): string {
  return (input || "")
    .replace(TASHKEEL, "")
    .replace(TATWEEL, "")
    .replace(/[آأإ]/g, "ا") // آأإ → ا
    .replace(/\s+/g, " ")
    .trim();
}

/** صيغة بحث أكثر طيّاً: تطوي ى→ي و ة→ه فوق التوحيد اللطيف. */
export function searchableText(input: string): string {
  return normalizeText(input)
    .replace(/ى/g, "ي") // ى → ي
    .replace(/ة/g, "ه"); // ة → ه
}

/** تقسيم إلى جمل بحدود عربية شائعة (نقطة، فاصلة منقوطة، سطر، ترقيم عربي). */
export function splitSentences(input: string): string[] {
  return (input || "")
    .split(/(?<=[.!?؟…])\s+|[\n\r]+|(?<=؛)\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** تقسيم إلى فقرات بفواصل الأسطر المزدوجة. */
export function splitParagraphs(input: string): string[] {
  return (input || "")
    .split(/\n{2,}|\r\n{2,}/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length > 0);
}

/** hash ثابت للنص الأصلي (لمنع إعادة المعالجة وكشف التكرار التام). */
export function textHash(input: string): string {
  return createHash("sha256").update(input || "", "utf8").digest("hex");
}

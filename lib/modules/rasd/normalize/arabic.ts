import { normalizeArabicText } from "@/lib/modules/legal-core/arabic-morphology";
import { normalizeDigitsForCompare } from "./numbers";

const CONTROL_AND_FORMAT_CHARS = /[\u0000-\u001F\u007F-\u009F\u061C\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g;
const TATWEEL = /\u0640/g;
const DIACRITICS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g;

export function stripInvisible(text: string): string {
  return text.replace(CONTROL_AND_FORMAT_CHARS, "");
}

export function unifyPunctuation(text: string): string {
  return text
    .replace(/[“”«»]/g, "\"")
    .replace(/[‘’]/g, "'")
    .replace(/[،]/g, ",")
    .replace(/[؛]/g, ";")
    .replace(/[؟]/g, "?")
    .replace(/[ـ]+/g, "")
    .replace(/\s*([,;:.!?؟،؛])\s*/g, "$1 ");
}

function keepReadableLegalMarks(text: string): string {
  return text
    .replace(/\(\s*([0-9]+)\s*\)/g, "($1)")
    .replace(/م\s*\/\s*([0-9]+)/g, "م/$1")
    .replace(/([0-9]+)\s*\/\s*([0-9]+)/g, "$1/$2");
}

export function normalizeForCompare(text: string): string {
  if (!text) return "";

  const prepared = keepReadableLegalMarks(
    normalizeDigitsForCompare(stripInvisible(text.normalize("NFC")).replace(TATWEEL, "").replace(DIACRITICS, ""))
  );

  // نمدد normalizeArabicText الموجود دون الاعتماد عليه وحده لأنه يحذف علامات مهمة لأرقام المواد والصكوك.
  const morphologyNormalized = normalizeArabicText(prepared);
  const lightNormalized = unifyPunctuation(prepared)
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ")
    .trim();

  return keepReadableLegalMarks(lightNormalized || morphologyNormalized)
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * anchors.ts — مراسي القراءة اللفظية (رابعًا). تُصنِّف بداية السطر إلى نوع وحدة،
 * وتلتقط التسمية وتعبير الرقم. المطابقة تجري على صورةٍ منزوعة التشكيل (لثبات
 * «أولاً/ثانياً»)، والتسمية تُؤخذ من السطر الخام.
 */
import type { DocUnitType } from "./types";

export interface LineAnchor {
  type: DocUnitType;
  label: string; // كما ورد (خام)
  numberExpr?: string; // يُمرَّر لـ parseArabicNumber
  title?: string;
}

// المادة (مع نصّ بعد النقطتين على السطر): «المادة الأولى: ...».
const RE_ARTICLE_INLINE = /^\s*المادة\s+([^\n:：]+?)\s*[:：]/;
// المادة (رقمها وحده على السطر): «المادة الأولى».
const RE_ARTICLE = /^\s*المادة\s+([^\n:：]+?)\s*[:：]?\s*(?:\n|$)/;
// التقسيمات: الباب/الفصل/القسم/الفرع + ترتيبي + عنوان اختياري بعد النقطتين.
const RE_DIVISION = /^\s*(الباب|الفصل|القسم|الفرع)\s+([^\n:：]+?)\s*(?:[:：]\s*(.*))?\s*(?:\n|$)/;
// بند المنطوق: أولًا/ثانيًا ... (التشكيل مُزال قبل المطابقة).
const RE_CLAUSE = /^\s*(اولا|ثانيا|ثالثا|رابعا|خامسا|سادسا|سابعا|ثامنا|تاسعا|عاشرا)\s*[:：]/;
// الاستناد (recital).
const RE_RECITAL = /^\s*(?:و?بعد\s+الاطلاع\s+على|بناء\s+على|و?بعد\s+النظر\s+في|و?بعد\s+الاطلاع)/;
// الفقرة: «1-» / «١-».
const RE_PARAGRAPH = /^\s*([0-9٠-٩]{1,3})\s*[-–—]\s*/;
// الفقرة الفرعية: حرف عربي مفرد + شرطة «أ-».
const RE_SUBPARA = /^\s*([ابتثجحخدذرزسشصضطظعغفقكلمنهوياىءأإؤئة])\s*[-–—]\s*/;
// زوج تعريف داخل مادة تعريفات: «المصطلح: التعريف».
const RE_DEFINITION_ITEM = /^\s*([^\n:：]{2,40})\s*[:：]\s*\S/;

export const DEFINITION_TRIGGERS = [/يقصد\s+ب/, /يكون\s+للكلمات\s+والعبارات/, /المقصود\s+ب/];

/** ينزع التشكيل والتطويل ويوحّد الهمزات للمطابقة فقط (لا للتخزين). */
function bare(s: string): string {
  return s.replace(/[ً-ْٰـ]/g, "").replace(/[أإآ]/g, "ا");
}

export function isDefinitionsArticle(text: string): boolean {
  const b = bare(text);
  return DEFINITION_TRIGGERS.some((re) => re.test(b));
}

/** يصنّف السطر إلى مرساة، أو null إن كان استمرارًا. */
export function classifyLine(line: string): LineAnchor | null {
  const b = bare(line);
  const label = line.trim();
  let m: RegExpMatchArray | null;

  if ((m = b.match(RE_DIVISION))) {
    const kindMap: Record<string, DocUnitType> = { الباب: "PART", الفصل: "CHAPTER", القسم: "SECTION", الفرع: "SECTION" };
    return { type: kindMap[m[1]] ?? "SECTION", label, numberExpr: m[2], title: m[3]?.trim() || undefined };
  }
  if ((m = b.match(RE_ARTICLE_INLINE)) || (m = b.match(RE_ARTICLE))) {
    return { type: "ARTICLE", label, numberExpr: m[1] };
  }
  if ((m = b.match(RE_CLAUSE))) {
    return { type: "INSTRUMENT_CLAUSE", label, numberExpr: m[1] };
  }
  if (RE_RECITAL.test(b)) {
    return { type: "RECITAL", label };
  }
  if ((m = b.match(RE_SUBPARA))) {
    return { type: "SUBPARAGRAPH", label, numberExpr: m[1] };
  }
  if ((m = b.match(RE_PARAGRAPH))) {
    return { type: "PARAGRAPH", label, numberExpr: m[1] };
  }
  return null;
}

/** يحاول تصنيف سطر داخل مادة تعريفات كزوج تعريف. */
export function classifyDefinitionItem(line: string): LineAnchor | null {
  const m = line.match(RE_DEFINITION_ITEM);
  if (!m) return null;
  return { type: "DEFINITION_ITEM", label: m[1].trim() };
}

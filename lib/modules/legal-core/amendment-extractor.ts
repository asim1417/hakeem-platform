/**
 * amendment-extractor.ts — استخراج أحداث تعديل/إلغاء/تصويب المواد من نصّها.
 *
 * الغرض: ملء جدول `article_amendments` (الجاهز في المخطّط، والفارغ من المنتِجين) من
 * حواشي التعديل المضمَّنة أصلًا في نصّ المادة، دون جلبٍ خارجيّ ودون قاعدة.
 *
 * مبدأ حاكم: **لا اختلاق**. لا يُنشأ حدثٌ إلا إذا اجتمع في النصّ:
 *   (١) فعل تعديل/إلغاء/تصويب/إعادة صريح، **و**
 *   (٢) أداةٌ نظاميّة (مرسوم/أمر/قرار) أو تاريخٌ هجريّ قريبٌ منه.
 * فبلا أداةٍ أو تاريخ يُترك السطر — لا نخمّن. وهذا يمنع التقاط النصّ الموضوعيّ
 * (مثل «يجوز للطرفين تعديل العقد») أو أداة الإصدار الأصليّة للمادة.
 *
 * يعتمد أدوات `decree-extractor.ts` نفسها (تطبيع الأرقام، التاريخ الهجريّ، الأدوات).
 */
import { normalizeDigits, extractRoyalDecree } from "./decree-extractor";

export type AmendmentChangeType = "amended" | "repealed" | "reinstated" | "corrected";

export interface AmendmentEvent {
  changeType: AmendmentChangeType;
  /** مرجع الأداة المُحدِثة كما استُخرج، أو null إن لم تُذكر أداةٌ صراحةً. */
  decreeRef: string | null;
  /** التاريخ الهجريّ كنصّ كما ورد، أو null. */
  hijriDate: string | null;
  /** ملخّصٌ قصيرٌ للجملة المُطلِقة (للمراجعة البشريّة). */
  summary: string;
  /** العبارة الجذر التي أطلقت الالتقاط. */
  marker: string;
}

// أفعال كل نوع — الأخصّ أوّلًا (إعادة/إلغاء/تصويب قبل التعديل العامّ).
// نطلب صيغة الماضي/المصدر المرتبطة بالحاشية، لا الأفعال المضارعة الموضوعيّة.
const VERB_GROUPS: Array<{ changeType: AmendmentChangeType; re: RegExp }> = [
  { changeType: "reinstated", re: /(?:أُعيد|أعيد|إعادة|اعيد)\s+(?:العمل|سريان)/ },
  { changeType: "repealed", re: /(?:أُلغِي|أُلغيت|ألغيت|أُلغيَت|أُلغى|نُسِخت|نُسخت|نسخت|مُلغاة|ملغاة|منسوخة|إلغاء)/ },
  { changeType: "corrected", re: /(?:صُحِّح|صُحّحت|صححت|تصويب|تصحيح|صوِّبت)/ },
  { changeType: "amended", re: /(?:عُدِّل|عُدّلت|عدّلت|عُدِّلت|عدلت|تعديل|استُبدل|استُبدلت|استبدلت|اسْتُبدلت|مُستبدلة|مستبدلة|استبدال|مُعدَّلة|معدّلة)/ },
];

// قرينة الأداة النظاميّة قربَ الفعل — شرطُ اعتبار السطر حاشية تعديل لا نصًّا موضوعيًّا.
const INSTRUMENT_HINT = /(?:بموجب|بمقتضى|بالمرسوم|بالأمر|بقرار|المرسوم\s*(?:ال)?ملكي|الأمر\s*(?:ال)?ملكي|قرار\s*مجلس\s*الوزراء)/;

/** يقصّ جملةً حول موضعٍ ما (للسياق والملخّص). */
function sentenceAround(text: string, index: number): string {
  const start = Math.max(0, text.lastIndexOf(".", index) + 1);
  let end = text.indexOf(".", index);
  if (end === -1) end = Math.min(text.length, index + 200);
  return text.slice(start, end + 1).trim();
}

/**
 * يستخرج كل أحداث التعديل الصريحة من النصّ. يعيد مصفوفةً (قد تكون فارغة)،
 * منزوعة التكرار حسب (changeType + decreeRef).
 */
export function extractAmendments(rawText: string | null | undefined): AmendmentEvent[] {
  if (!rawText) return [];
  const text = normalizeDigits(String(rawText)).replace(/\s+/g, " ").trim();
  if (!text) return [];

  const events: AmendmentEvent[] = [];
  const seen = new Set<string>();

  for (const { changeType, re } of VERB_GROUPS) {
    const g = new RegExp(re.source, "g");
    let m: RegExpExecArray | null;
    while ((m = g.exec(text)) !== null) {
      const marker = m[0];
      // نافذة أمام الفعل: هنا تُذكر الأداة والتاريخ عادةً في الحواشي السعوديّة.
      const window = text.slice(m.index, Math.min(text.length, m.index + 160));

      // شرط عدم الاختلاق: لا بدّ من قرينة أداةٍ نظاميّة قربَ الفعل.
      if (!INSTRUMENT_HINT.test(window)) continue;

      const decree = extractRoyalDecree(window);
      const hijriDate = decree?.hijriDate ?? null;
      // لا بدّ من أداةٍ مُستخرَجة (أو على الأقلّ تاريخ) — وإلّا فالإشارة ضعيفة تُترك.
      if (!decree && !hijriDate) continue;

      const decreeRef = decree?.decree ?? null;
      const key = `${changeType}|${decreeRef ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);

      events.push({
        changeType,
        decreeRef,
        hijriDate,
        summary: sentenceAround(text, m.index).slice(0, 200),
        marker,
      });
    }
  }

  return events;
}

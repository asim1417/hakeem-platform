/**
 * uqn-classify.ts — تصنيف عنصر التغذية إلى نوع واحد (خامسًا-٤).
 * حتميّ لفظيّ (لا توليد). ما هو «خارج النطاق» يُؤرشَف ولا يُدخَل.
 * النتائج القريبة من التعارض تُصنَّف بأحوط الفئات ثم تُراجَع بشريًّا عند الإدخال.
 */
export type UqnCategory =
  | "system_new" // نظام جديد
  | "amendment" // تعديل
  | "repeal_or_replace" // إلغاء أو إحلال
  | "bylaw_or_rules" // لائحة أو قواعد
  | "instrument" // أداة إصدار (مرسوم/قرار) دون نصّ نظام مستقلّ
  | "out_of_scope"; // مذكرات تفاهم، تسميات أعوام، قرارات فردية

const OUT_OF_SCOPE = /مذكرة\s+تفاهم|اتفاقية|تعيين|ترقية|إحالة\s+على\s+التقاعد|تسمية\s+عام|منح\s+وسام|قرار\s+فردي/;
const REPEAL_REPLACE = /يُلغى|يلغى|إلغاء\s+نظام|يحلّ?\s+محلّ?|إحلال/;
const AMENDMENT = /تعديل|إضافة\s+مادة|إضافة\s+فقرة|حذف\s+(?:الفقرة|المادة)|ليكون\s+بالنصّ?\s+الآتي/;
const BYLAW = /اللائحة\s+التنفيذية|قواعد\s+تنظيمية|الضوابط\s+والإجراءات|القواعد\s+المنظّمة/;
const INSTRUMENT = /مرسوم\s+ملكي|قرار\s+مجلس\s+الوزراء|أمر\s+ملكي|قرار\s+مجلس\s+الشورى/;
const SYSTEM = /نظام|لائحة/;

/** يصنّف بحسب العنوان أساسًا والنصّ تعزيزًا. */
export function classifyUqnItem(title: string, description = ""): UqnCategory {
  const t = title.trim();
  const both = `${t}\n${description}`;
  if (OUT_OF_SCOPE.test(t)) return "out_of_scope";
  if (REPEAL_REPLACE.test(both)) return "repeal_or_replace";
  if (AMENDMENT.test(both)) return "amendment";
  if (BYLAW.test(t)) return "bylaw_or_rules";
  if (INSTRUMENT.test(t) && !/نظام/.test(t)) return "instrument";
  if (SYSTEM.test(t)) return "system_new";
  return "out_of_scope";
}

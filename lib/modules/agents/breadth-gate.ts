// ─────────────────────────────────────────────────────────────────────────────
// بوّابة الاتّساع (المرحلة ١) — تكشف السؤال الواسع («كل [بُعد] في الأنظمة» بلا نظام محدّد)
// وتُرجِع **استيضاحًا بخيارات (٢–٣)** بدل التخمين وإعطاء عيّنة موهِمة بالشمول. المبدأ:
// أشرِك المستخدم، لا تقرّر عنه. حتميّ ونقيّ — يُختبَر بلا نموذج ولا قاعدة.
// ─────────────────────────────────────────────────────────────────────────────
import { normalizeArabicText } from "@/lib/modules/legal-core/arabic-morphology";
import { classifyBreadthDeterministic } from "./breadth-classifier";

/** خيار استيضاح — يُرسَل كرسالة تالية عند نقره في الواجهة. */
export interface ClarifyOption {
  id: string;
  label: string;
  /** الاستعلام الذي يُرسَل عند اختيار هذا الخيار. */
  query: string;
  /** استقصاء شامل (وضع عميق + تجاوز البوّابة كي لا تتكرّر). */
  exhaustive?: boolean;
  hint?: string;
}

export interface BreadthClarification {
  broad: true;
  message: string;
  dimension: string;
  options: ClarifyOption[]; // ٢–٣ كحدّ أقصى
}

// أبعاد واسعة تتوزّع عبر أنظمة كثيرة، ولكلٍّ خيارات مناسبة (٢ + استقصاء شامل).
interface Dimension {
  key: string;
  label: string;
  markers: string[];
  focused: Array<{ label: string; query: string }>; // خياران مركّزان قابلان للتنفيذ فورًا
}
const DIMENSIONS: Dimension[] = [
  {
    key: "durations",
    label: "المدد والمواعيد",
    markers: ["مدة", "مدد", "المدة", "المدد", "مهلة", "مهل", "أجل", "آجال", "ميعاد", "مواعيد", "مواعید"],
    focused: [
      { label: "مدد التقاضي والمرافعات", query: "ما هي المدد والمواعيد في نظام المرافعات الشرعية" },
      { label: "مدد نظام المعاملات المدنية", query: "ما هي كل المدد في نظام المعاملات المدنية" },
    ],
  },
  {
    key: "penalties",
    label: "العقوبات والجزاءات",
    markers: ["عقوبة", "عقوبات", "جزاء", "جزاءات", "غرامة", "غرامات", "الحدود"],
    focused: [
      { label: "العقوبات الجزائية", query: "ما هي العقوبات في نظام الإجراءات الجزائية" },
      { label: "الجزاءات العمّالية", query: "ما هي الجزاءات في نظام العمل" },
    ],
  },
  {
    key: "conditions",
    label: "الشروط والأركان",
    markers: ["شرط", "شروط", "ركن", "أركان", "ضوابط"],
    focused: [{ label: "الشروط في المعاملات المدنية", query: "ما هي شروط صحّة العقد في نظام المعاملات المدنية" }],
  },
  {
    key: "rights",
    label: "الحقوق والالتزامات",
    markers: ["حق", "حقوق", "التزام", "التزامات", "واجب", "واجبات"],
    focused: [
      { label: "حقوق والتزامات العامل", query: "ما هي حقوق والتزامات العامل في نظام العمل" },
      { label: "الالتزامات في المعاملات المدنية", query: "ما هي الالتزامات في نظام المعاملات المدنية" },
    ],
  },
];

/** يكشف بُعدًا واسعًا معروفًا في السؤال (مدد/عقوبات/شروط/حقوق…) — حتميّ نقيّ. */
export function findDimension(query: string): Dimension | null {
  const n = normalizeArabicText(query || "");
  if (!n) return null;
  return DIMENSIONS.find((d) => d.markers.some((m) => n.includes(normalizeArabicText(m)))) ?? null;
}

/** استيضاح الاستقصاء: خياران مركّزان + استقصاء شامل (للسؤال الاستقصائي بلا نظام مذكور). */
function buildExhaustiveClarification(query: string, dim: Dimension): BreadthClarification {
  const options: ClarifyOption[] = [
    ...dim.focused.slice(0, 2).map((f, i) => ({ id: `focus-${i + 1}`, label: f.label, query: f.query })),
    { id: "exhaustive", label: "استقصاء شامل عبر الأنظمة (أعمق، يستغرق وقتًا)", query: query.trim(), exhaustive: true, hint: "يفحص عدّة أنظمة ويعرض النتائج بالتدرّج" },
  ];
  return {
    broad: true,
    dimension: dim.label,
    message: `سؤالك عن «${dim.label}» يشمل عدّة أنظمة. لأخدمك بدقّة، أي اتجاه تريد؟`,
    options,
  };
}

/** استيضاح الالتباس: خياران فقط — الجواب المباشر عن المسألة، أو الاستقصاء الشامل. */
function buildAmbiguousClarification(query: string, dim: Dimension): BreadthClarification {
  const q = query.trim();
  return {
    broad: true,
    dimension: dim.label,
    message: `سؤالك عن «${dim.label}» يحتمل وجهين: جوابًا مباشرًا عن مسألةٍ بعينها، أو استقصاءً لكل ما يتعلّق بـ«${dim.label}». أيّهما تريد؟`,
    options: [
      { id: "direct", label: "الجواب المباشر عن المسألة", query: q, hint: "إجابة مركّزة من المادة الحاكمة" },
      { id: "exhaustive", label: "استقصاء شامل (أعمق، يستغرق وقتًا)", query: q, exhaustive: true, hint: "يفحص كل المواد المتعلّقة بالبُعد" },
    ],
  };
}

/**
 * يكشف حاجة الاستيضاح وفق تصنيف الاتّساع (٣ فئات، حتميّ نقيّ هنا):
 *   • محدّد → null (يُبحَث مباشرةً، بلا استقصاء).
 *   • استقصائيّ + نظام مذكور → null (يتولّاه المسح الكامل للنظام لا الاستيضاح).
 *   • استقصائيّ بلا نظام → استيضاح الاستقصاء (خيارات مركّزة + شامل).
 *   • ملتبس → استيضاح بخيارين (مباشر · شامل).
 * (التصنيف بالنموذج يجري في المنسّق؛ هذا المسار الحتميّ للاختبار والسقوط الآمن.)
 */
export function detectBreadth(query: string, opts: { hasSystem: boolean }): BreadthClarification | null {
  const dim = findDimension(query);
  if (!dim) return null;
  const klass = classifyBreadthDeterministic(query, { hasSystem: opts.hasSystem, hasDimension: true });
  if (klass === "specific") return null;
  if (klass === "exhaustive") return opts.hasSystem ? null : buildExhaustiveClarification(query, dim);
  return buildAmbiguousClarification(query, dim);
}

/** يبني استيضاحًا من فئةٍ مُصنَّفة مسبقًا (يُستعمَل في المنسّق مع تصنيف النموذج). */
export function buildClarificationForClass(
  query: string,
  klass: "exhaustive" | "ambiguous",
  opts: { hasSystem: boolean }
): BreadthClarification | null {
  const dim = findDimension(query);
  if (!dim) return null;
  if (klass === "exhaustive") return opts.hasSystem ? null : buildExhaustiveClarification(query, dim);
  return buildAmbiguousClarification(query, dim);
}

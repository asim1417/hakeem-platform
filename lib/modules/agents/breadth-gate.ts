// ─────────────────────────────────────────────────────────────────────────────
// بوّابة الاتّساع (المرحلة ١) — تكشف السؤال الواسع («كل [بُعد] في الأنظمة» بلا نظام محدّد)
// وتُرجِع **استيضاحًا بخيارات (٢–٣)** بدل التخمين وإعطاء عيّنة موهِمة بالشمول. المبدأ:
// أشرِك المستخدم، لا تقرّر عنه. حتميّ ونقيّ — يُختبَر بلا نموذج ولا قاعدة.
// ─────────────────────────────────────────────────────────────────────────────
import { normalizeArabicText } from "@/lib/modules/legal-core/arabic-morphology";

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

// علامات الحصر (تدلّ على «الكلّ»). بلا واحدة منها → ليس واسعًا (سؤال محدّد).
const ENUM_MARKERS = ["كل ", "جميع", "كافة", "ما هي", "ماهي", "عدد ", "عدّد", "قائمة", "حصر", "استقصاء"];

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

// دلائل أن السؤال يقصد «عبر الأنظمة» عمومًا (لا نظامًا بعينه).
const CROSS_SYSTEM_HINTS = ["الانظمه", "الانظمة", "القانون السعودي", "الانظمه السعوديه", "كل الانظمه", "جميع الانظمه", "عبر الانظمه"];

/**
 * يكشف السؤال الواسع ويُرجِع استيضاحًا بخيارات. الشروط:
 *   • فيه علامة حصر (كل/جميع/ما هي…)، و
 *   • فيه بُعد واسع (مدد/عقوبات/شروط/حقوق…)، و
 *   • **لم يُذكر نظام محدّد** (hasSystem=false).
 * وإلا → null (سؤال محدّد يُبحَث مباشرةً).
 */
export function detectBreadth(query: string, opts: { hasSystem: boolean }): BreadthClarification | null {
  if (opts.hasSystem) return null; // نظام مذكور → محدّد
  const n = normalizeArabicText(query || "");
  if (!n) return null;

  const hasEnum = ENUM_MARKERS.some((m) => n.includes(normalizeArabicText(m)));
  if (!hasEnum) return null;

  const dim = DIMENSIONS.find((d) => d.markers.some((m) => n.includes(normalizeArabicText(m))));
  if (!dim) return null;

  // ترجيح إضافيّ: وجود دلالة «عبر الأنظمة» يقوّي الاتّساع (لكن ليس شرطًا — غياب النظام يكفي).
  const crossHint = CROSS_SYSTEM_HINTS.some((h) => n.includes(normalizeArabicText(h)));

  const options: ClarifyOption[] = [
    ...dim.focused.slice(0, 2).map((f, i) => ({ id: `focus-${i + 1}`, label: f.label, query: f.query })),
    {
      id: "exhaustive",
      label: "استقصاء شامل عبر الأنظمة (أعمق، يستغرق وقتًا)",
      query: query.trim(),
      exhaustive: true,
      hint: "يفحص عدّة أنظمة ويعرض النتائج بالتدرّج",
    },
  ];

  return {
    broad: true,
    dimension: dim.label,
    message: `سؤالك عن «${dim.label}» يشمل عدّة أنظمة${crossHint ? " سعودية" : ""}. لأخدمك بدقّة، أي اتجاه تريد؟`,
    options,
  };
}

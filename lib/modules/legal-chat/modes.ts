// ─────────────────────────────────────────────────────────────────────────────
// Legal Modes + Search Strength + Prompt Library — إعدادات الواجهة وتوجيه التفكير.
// كل نمط يغيّر طريقة التفكير والأسئلة والمخرجات؛ وكل قوة بحث تحدّد عمق الاسترجاع.
// ─────────────────────────────────────────────────────────────────────────────
import type { SearchStrength, SimulationMode } from "./types";
import { MODE_LABELS } from "./taxonomy";

export interface ModeConfig {
  mode: SimulationMode;
  label: string;
  description: string;
  /** توجيه إضافي يُحقن في تعليمات النظام عند الصياغة. */
  systemHint: string;
}

export const MODE_CONFIGS: Record<SimulationMode, ModeConfig> = {
  RESEARCHER: {
    mode: "RESEARCHER",
    label: MODE_LABELS.RESEARCHER,
    description: "بحث وتحليل قانوني محايد مستند للنواة.",
    systemHint: "التزم الحياد العلمي، واربط كل نتيجة بمصدرها من النواة، وميّز النص الصريح عن الاستنتاج.",
  },
  PLAINTIFF_LAWYER: {
    mode: "PLAINTIFF_LAWYER",
    label: MODE_LABELS.PLAINTIFF_LAWYER,
    description: "بناء مركز المدعي وتعزيز مطالبه.",
    systemHint: "فكّر كوكيل للمدعي: عزّز الطلبات بالبيّنة والإسناد، وتوقّع دفوع الخصم وردّ عليها.",
  },
  DEFENDANT_LAWYER: {
    mode: "DEFENDANT_LAWYER",
    label: MODE_LABELS.DEFENDANT_LAWYER,
    description: "بناء دفاع المدعى عليه شكلاً وموضوعاً.",
    systemHint: "فكّر كوكيل للمدعى عليه: قدّم الدفوع الشكلية أولاً ثم الموضوعية، وفنّد بيّنة الخصم.",
  },
  OPPONENT: {
    mode: "OPPONENT",
    label: MODE_LABELS.OPPONENT,
    description: "الخصم الافتراضي: يتوقّع دفوع الطرف الآخر ونقاط الضعف.",
    systemHint: "تقمّص الخصم: استخرج أقوى دفوعه المحتملة ونقاط ضعف المستخدم والمستندات التي سيطلبها.",
  },
  JUDGE: {
    mode: "JUDGE",
    label: MODE_LABELS.JUDGE,
    description: "القاضي الافتراضي (تدريبي): يحرر محل النزاع ويقدّر الاتجاه.",
    systemHint: "حرّر محل النزاع، وحدّد الوقائع المنتِجة وعبء الإثبات، واطرح أسئلة القاضي، ثم قدّر اتجاهاً احتمالياً غير ملزم. نبّه أنها محاكاة تعليمية.",
  },
  ARBITRATOR: {
    mode: "ARBITRATOR",
    label: MODE_LABELS.ARBITRATOR,
    description: "المحكّم: يبدأ من اتفاق التحكيم والاختصاص.",
    systemHint: "ابدأ من اتفاق التحكيم ونطاقه وتشكيل الهيئة والاختصاص والنظام الواجب التطبيق، ثم الطلبات والدفوع والبيّنات.",
  },
  DRAFTING_REVIEWER: {
    mode: "DRAFTING_REVIEWER",
    label: MODE_LABELS.DRAFTING_REVIEWER,
    description: "مراجع الصياغة: يحسّن الهيكل ويكشف الضعف.",
    systemHint: "راجع الصياغة: افصل الوقائع عن الدفوع عن الأسباب، اختصر غير المنتج، واكشف مواطن الضعف.",
  },
  EVIDENCE_EXAMINER: {
    mode: "EVIDENCE_EXAMINER",
    label: MODE_LABELS.EVIDENCE_EXAMINER,
    description: "فاحص الإثبات: عبء الإثبات وقوة الدليل.",
    systemHint: "ركّز على الوقائع محل الإثبات، عبء الإثبات، قبول الدليل وإنتاجه وكفايته، والنقص والإجراء المقترح.",
  },
  JUDGMENT_EXAMINER: {
    mode: "JUDGMENT_EXAMINER",
    label: MODE_LABELS.JUDGMENT_EXAMINER,
    description: "فاحص الحكم: مواضع الخطأ وفرص الاعتراض.",
    systemHint: "حلّل الحكم: المنطوق والأسباب، ومواضع الخطأ النظامي/الإجرائي/الإثباتي، وفرص الاعتراض.",
  },
  CONTRACT_EXAMINER: {
    mode: "CONTRACT_EXAMINER",
    label: MODE_LABELS.CONTRACT_EXAMINER,
    description: "فاحص العقد: البنود والمخاطر والتوصيات.",
    systemHint: "استخرج الأطراف والالتزامات والمدد والشرط الجزائي وشرط التحكيم والاختصاص والفسخ، وبيّن المخاطر والتوصيات.",
  },
};

export interface SearchStrengthConfig {
  strength: SearchStrength;
  label: string;
  description: string;
}

export const SEARCH_STRENGTH_CONFIGS: Record<SearchStrength, SearchStrengthConfig> = {
  QUICK: { strength: "QUICK", label: "بحث سريع", description: "مواد أساسية فقط — جواب مختصر." },
  BALANCED: { strength: "BALANCED", label: "بحث متوازن", description: "مواد ولوائح أساسية." },
  DEEP: { strength: "DEEP", label: "بحث عميق", description: "مواد ولوائح ومصطلحات مع مسائل فرعية." },
  JUDICIAL_EXTENDED: { strength: "JUDICIAL_EXTENDED", label: "بحث قضائي موسّع", description: "مواد وأحكام واتجاهات (عند تفعيل قاعدة الأحكام)." },
  ARBITRATION: { strength: "ARBITRATION", label: "بحث تحكيمي", description: "نظام التحكيم والإجراءات والمخاطر." },
};

/** مكتبة أوامر قانونية جاهزة داخل الواجهة. */
export interface PromptLibraryItem {
  label: string;
  prompt: string;
}

export const PROMPT_LIBRARY: PromptLibraryItem[] = [
  { label: "حلّل هذه الدعوى", prompt: "حلّل هذه الدعوى وبيّن مركزي القانوني ونقاط القوة والضعف." },
  { label: "أعدّ مذكرة جوابية", prompt: "أنا مدّعى عليه وأريد إعداد مذكرة جوابية على دعوى مرفوعة ضدي." },
  { label: "توقّع دفوع الخصم", prompt: "توقّع دفوع الخصم المحتملة في قضيتي واقترح ردوداً عليها." },
  { label: "ابنِ خطة إثبات", prompt: "ابنِ لي خطة إثبات تربط كل واقعة بدليلها وبيّن النقص والإجراء المقترح." },
  { label: "حلّل الحكم للاستئناف", prompt: "صدر ضدي حكم وأريد تحليله لأسباب الاستئناف." },
  { label: "صُغ لائحة اعتراض", prompt: "أريد صياغة لائحة اعتراض على حكم صادر ضدي." },
  { label: "افحص شرط التحكيم", prompt: "افحص هل شرط التحكيم في عقدي يحجب اختصاص القضاء." },
  { label: "راجع هذا العقد", prompt: "أريد مراجعة عقد واستخراج الالتزامات والمخاطر والتوصيات." },
  { label: "حرّر محل النزاع", prompt: "حرّر محل النزاع في قضيتي وحدّد الوقائع المنتِجة." },
  { label: "حاكِ جلسة قضائية", prompt: "حاكِ جلسة قضائية في قضيتي وبيّن أسئلة القاضي المحتملة." },
  { label: "صُغ حكماً افتراضياً", prompt: "صُغ مسودة حكم افتراضي تدريبي في قضيتي." },
  { label: "أعطني النواقص قبل الجلسة", prompt: "ما النواقص المؤثّرة في ملفي قبل الجلسة القادمة؟" },
];

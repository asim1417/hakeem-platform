// ─────────────────────────────────────────────────────────────────────────────
// المرحلة ١.ب — تفكيك المعيار (Normative tagging). لكل مادة وسمٌ بنيويّ:
//   { addressee (المخاطَب), modality (نوع الحكم), condition?, effect? }
// modality ∈ إلزام | إباحة | حظر | رخصة_تقديرية.
// هذا المُصنِّف **الحتميّ** أساسٌ للتوسيم offline (سقوط آمن لسكربت الوسم حين يغيب المزوّد)،
// ويُخزَّن الناتج مفهرسًا في أعمدة المادة (المرحلة ١.ب/الهجرة) للاستعلام المفهوميّ (المرحلة ٣).
// نقيّ وقابل للاختبار — لا قاعدة، لا نموذج، لا أمن.
// ─────────────────────────────────────────────────────────────────────────────
import { normalizeArabicText } from "@/lib/modules/legal-core/arabic-morphology";

export type NormativeModality = "إلزام" | "إباحة" | "حظر" | "رخصة_تقديرية";

export interface NormativeTag {
  addressee?: string; // المخاطَب بالحكم (المحكمة/صاحب العمل/العامل/التاجر…)
  modality?: NormativeModality;
  condition?: string; // الشرط (إن وُجد صراحةً)
  effect?: string; // الأثر/الجزاء (إن وُجد صراحةً)
  source: "rule" | "model"; // حتميّ (قواعد) أم من النموذج (سكربت الوسم)
}

// علامات الجهة المخاطَبة — تُطبَّع عند الإنشاء لتطابق النصّ المُطبَّع.
const ADDRESSEE_MARKERS: Array<{ label: string; markers: string[] }> = [
  // علامات المحكمة بجذرٍ مجرّد من «ال»/حرف الجرّ — كي تطابق «للمحكمة/بالمحكمة/المحكمة».
  { label: "المحكمة", markers: ["محكمة", "دائرة", "قاضي", "قاض", "ناظر القضية"] },
  { label: "صاحب العمل", markers: ["صاحب العمل", "رب العمل", "المنشأة"] },
  { label: "العامل", markers: ["العامل", "الأجير", "الموظف"] },
  { label: "التاجر", markers: ["التاجر", "المنشأة التجارية"] },
  { label: "الشريك", markers: ["الشريك", "الشركاء", "المساهم"] },
  { label: "الجهة الإدارية", markers: ["الوزير", "الوزارة", "الجهة المختصة", "الهيئة", "الجهة الحكومية"] },
  { label: "المؤجر", markers: ["المؤجر"] },
  { label: "المستأجر", markers: ["المستأجر"] },
  { label: "الدائن", markers: ["الدائن"] },
  { label: "المدين", markers: ["المدين"] },
];

// أفعال/صيغ الحكم (مُطبَّعة). الترتيب حاسم: الحظر ثم الرخصة التقديرية ثم الإلزام ثم الإباحة.
const HAZR = ["يحظر", "يمنع", "لا يجوز", "لا يحل", "يحرم", "محظور", "لا يسوغ", "يُحظر", "يُمنع"];
const ILZAM = ["يجب", "يلتزم", "يتعين", "على كل", "لا بد", "وجب", "ملزم", "يُلزم", "تلتزم", "يجب على"];
const IBAHA = ["يجوز", "يحق", "له أن", "يسوغ", "جاز", "له الحق", "مباح", "يُباح"];
// دلائل الرخصة التقديرية: إباحة/تخيير مقرونة بالمخاطَب «المحكمة/القاضي» أو بصيغة التقدير.
const DISCRETION_HINTS = ["تقدير", "بحسب ما تراه", "وفقًا لما تراه", "متى رأت", "إذا رأت", "حسبما تراه", "ما تراه محققًا", "بما يحقق"];

/** يُطبِّع قائمة علامات مرة واحدة. */
function norm(list: string[]): string[] {
  return list.map((s) => normalizeArabicText(s));
}
const N_HAZR = norm(HAZR);
const N_ILZAM = norm(ILZAM);
const N_IBAHA = norm(IBAHA);
const N_DISCRETION = norm(DISCRETION_HINTS);
const N_COURT = norm(["محكمة", "دائرة", "قاضي", "قاض"]);

function includesAny(hay: string, needles: string[]): boolean {
  return needles.some((n) => n && hay.includes(n));
}

/** يستنتج المخاطَب من أول علامة مطابقة (مُطبَّعة). */
export function inferAddressee(text: string): string | undefined {
  const h = normalizeArabicText(text);
  for (const a of ADDRESSEE_MARKERS) {
    if (includesAny(h, norm(a.markers))) return a.label;
  }
  return undefined;
}

/**
 * يستنتج نوع الحكم (modality) حتميًّا من صيغ المادة.
 * الأولوية: حظر > رخصة تقديرية (إباحة+محكمة/تقدير) > إلزام > إباحة.
 */
export function inferModality(text: string): NormativeModality | undefined {
  const h = normalizeArabicText(text);
  if (includesAny(h, N_HAZR)) return "حظر";
  const permissive = includesAny(h, N_IBAHA);
  const courtBound = includesAny(h, N_COURT);
  const discretion = includesAny(h, N_DISCRETION);
  // رخصة تقديرية: تخيير/إباحة مقرونة بالمحكمة، أو صيغة تقدير صريحة.
  if ((permissive && courtBound) || (discretion && (courtBound || permissive))) return "رخصة_تقديرية";
  if (includesAny(h, N_ILZAM)) return "إلزام";
  if (permissive) return "إباحة";
  return undefined;
}

/** الوسم الكامل الحتميّ لمادة (offline). source='rule'. */
export function inferNormative(text: string): NormativeTag {
  return {
    addressee: inferAddressee(text),
    modality: inferModality(text),
    source: "rule",
  };
}

/** تحقّق قيمة modality واردة من مصدر خارجيّ (النموذج) — يحمي العمود المفهرس من قيَم فاسدة. */
export function isValidModality(v: unknown): v is NormativeModality {
  return v === "إلزام" || v === "إباحة" || v === "حظر" || v === "رخصة_تقديرية";
}

// عبارات تدلّ على **مفهوم معياريّ** في السؤال (لوضع المسح المفهوميّ — المرحلة ٣).
const CONCEPT_DISCRETION = norm(["السلطة التقديرية", "سلطة تقديرية", "تقدير المحكمة", "التقدير القضائي", "سلطة القاضي التقديرية", "الصلاحية التقديرية"]);
const CONCEPT_HAZR = norm(["المحظورات", "ما يحظر", "الممنوعات", "ما يمنع", "المحرمات"]);
const CONCEPT_ILZAM = norm(["الالتزامات", "الواجبات", "ما يجب", "التزامات"]);
const CONCEPT_IBAHA = norm(["الرخص", "ما يجوز", "المباحات", "الرخصة"]);

/**
 * يكشف مفهومًا معياريًّا في السؤال ويحوّله إلى مرشِّح استعلام (modality [+ addressee]).
 * أساس «السلطة التقديرية» → {modality:'رخصة_تقديرية', addressee:'المحكمة'} (قبول HLS‑5.5).
 * يعيد null إن لم يُذكر مفهوم معياريّ صريح. حتميّ ونقيّ.
 */
export function detectNormativeConcept(query: string): { modality: NormativeModality; addressee?: string } | null {
  const h = normalizeArabicText(query || "");
  const courtBound = includesAny(h, N_COURT);
  if (includesAny(h, CONCEPT_DISCRETION)) return { modality: "رخصة_تقديرية", addressee: "المحكمة" };
  if (includesAny(h, CONCEPT_HAZR)) return { modality: "حظر", addressee: courtBound ? "المحكمة" : undefined };
  if (includesAny(h, CONCEPT_ILZAM)) return { modality: "إلزام", addressee: courtBound ? "المحكمة" : undefined };
  if (includesAny(h, CONCEPT_IBAHA)) return { modality: "إباحة", addressee: courtBound ? "المحكمة" : undefined };
  return null;
}

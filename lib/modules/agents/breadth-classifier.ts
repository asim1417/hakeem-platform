// ─────────────────────────────────────────────────────────────────────────────
// مصنّف الاتّساع (٣ فئات) — يميّز السؤال المحدّد عن الاستقصائي عن الملتبس.
// المبدأ الحاسم: وجود بُعد قابل للحصر (مدّة/عقوبة/شرط…) لا يجعل السؤال استقصائيًا؛
// الاستقصاء يتطلّب **دلالة شمول صريحة** (كل/جميع…)، أو جمعًا عبر الأنظمة. النموذج يقود
// التصنيف (تعميمًا لا قائمة كلمات جامدة)، مع سقوط حتميّ نقيّ يُختبَر بلا نموذج ولا قاعدة.
// ─────────────────────────────────────────────────────────────────────────────
import { normalizeArabicText } from "@/lib/modules/legal-core/arabic-morphology";

export type BreadthClass = "specific" | "exhaustive" | "ambiguous";

// دلالة الشمول الصريحة (طلب «الكلّ») — لا تشمل فواتح الأسئلة («ما هي») لأنها ليست شمولًا.
const UNIVERSAL_MARKERS = ["كل ", "جميع", "كافة", "سائر", "استقص", "احصر", "اجمع كل", "كل ما", "عدد كل", "عدّد كل"];
// دلالة العبور عبر الأنظمة (لا نظامًا بعينه).
const CROSS_SYSTEM_MARKERS = ["الانظمه", "الانظمة", "القانون السعودي", "عبر الانظمه", "كل الانظمه", "جميع الانظمه", "مختلف الانظمه"];
// صيغ الجمع للأبعاد (تدلّ على «المجموعة» لا مسألة مفردة) — مقابل المفرد (مدة/عقوبة/شرط…).
const PLURAL_DIMENSION_MARKERS = [
  "المدد", "مدد", "مواعيد", "المواعيد", "مهل", "المهل", "اجال", "الاجال",
  "عقوبات", "العقوبات", "جزاءات", "الجزاءات", "غرامات", "الغرامات", "الحدود",
  "شروط", "الشروط", "اركان", "الاركان", "ضوابط", "الضوابط",
  "حقوق", "الحقوق", "التزامات", "الالتزامات", "واجبات", "الواجبات",
];

function includesAny(normalizedQuery: string, markers: string[]): boolean {
  return markers.some((m) => normalizedQuery.includes(normalizeArabicText(m)));
}

/**
 * تصنيف حتميّ نقيّ (بلا نموذج) — سقوط آمن ومعيار مرجعيّ للاختبار:
 *   • بلا بُعد قابل للحصر → محدّد.
 *   • شمول صريح (كل/جميع…) → استقصائي (سواء نظام مذكور أو عبر الأنظمة).
 *   • جمعٌ بلا شمول صريح: عبر الأنظمة → استقصائي؛ وإلا → ملتبس.
 *   • مفرد (مدة/عقوبة… لمسألة معيّنة) → محدّد.
 */
export function classifyBreadthDeterministic(query: string, opts: { hasSystem: boolean; hasDimension: boolean }): BreadthClass {
  if (!opts.hasDimension) return "specific";
  const n = normalizeArabicText(query || "");
  const universal = includesAny(n, UNIVERSAL_MARKERS);
  const cross = includesAny(n, CROSS_SYSTEM_MARKERS);
  const plural = includesAny(n, PLURAL_DIMENSION_MARKERS);

  if (universal) return "exhaustive";
  if (plural) return cross ? "exhaustive" : "ambiguous";
  return "specific";
}

const CLASSIFY_SYSTEM_PROMPT = [
  "أنت مصنّف نيّة لأسئلة قانونية سعودية داخل منصة حكيم. صنّف السؤال إلى إحدى ثلاث:",
  "- specific: مسألة معيّنة لها جواب مباشر، حتى لو فيها بُعد قابل للحصر (مثل «مدة الاستئناف»، «موعد صرف الأجر»، «عقوبة الرشوة»).",
  "- exhaustive: يطلب **كل/جميع** عناصر بُعدٍ صراحةً، أو عبر الأنظمة (مثل «كل المدد في الأنظمة»، «اذكر جميع العقوبات»).",
  "- ambiguous: يحتمل الوجهين (مثل «المدد في نظام العمل» — قد تعني مدةً بعينها أو كلّها).",
  "القاعدة: مجرّد وجود بُعد (مدّة/عقوبة/شرط) لا يجعله استقصائيًا؛ الاستقصاء يحتاج دلالة الشمول الصريحة (كل/جميع) أو الجمع عبر الأنظمة.",
  'أعِد JSON فقط: {"class":"specific|exhaustive|ambiguous"}',
].join("\n");

function parseClass(content: string): BreadthClass | null {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    const obj = JSON.parse(content.slice(start, end + 1)) as { class?: unknown };
    const c = typeof obj.class === "string" ? obj.class.trim() : "";
    if (c === "specific" || c === "exhaustive" || c === "ambiguous") return c;
  } catch {
    /* تجاهل */
  }
  return null;
}

/**
 * تصنيف الاتّساع بالنموذج (تعميمًا)، مع سقوط آمن للمصنّف الحتميّ عند تعذّر النموذج/CI.
 * خلف راية AGENT_LLM_BREADTH (افتراضيّها مُفعّل)؛ =0 يقصر على الحتميّ.
 */
export async function classifyBreadth(query: string, opts: { hasSystem: boolean; hasDimension: boolean }): Promise<{ breadthClass: BreadthClass; source: "model" | "deterministic" }> {
  const deterministic = classifyBreadthDeterministic(query, opts);
  if (!opts.hasDimension || process.env.AGENT_LLM_BREADTH === "0") {
    return { breadthClass: deterministic, source: "deterministic" };
  }
  try {
    const { callCentralProvider } = await import("@/lib/modules/ai/ai-gateway");
    const llm = await callCentralProvider({ systemPrompt: CLASSIFY_SYSTEM_PROMPT, userPrompt: `السؤال: ${query}`, maxTokens: 60 });
    if (llm.ok && llm.content.trim()) {
      const parsed = parseClass(llm.content);
      if (parsed) return { breadthClass: parsed, source: "model" };
    }
  } catch {
    /* سقوط للحتميّ */
  }
  return { breadthClass: deterministic, source: "deterministic" };
}

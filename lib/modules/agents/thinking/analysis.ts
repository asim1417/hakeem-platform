// ─────────────────────────────────────────────────────────────────────────────
// التحليل (المرحلة ٤) — يطابق الأركان بالوقائع، يوازن، يرجّح. يبني حصرًا على مواد مُتحقَّقة.
// يقوده النموذج (callCentralProvider) مع سقوط آمن. يستدعي مهارة التدقيق (المرحلة ٧ تربطها).
// لا يُصدر حكمًا جازمًا في موضع اجتهاد (يُوسم بالاحتمال) — والامتناع عند غياب السند.
// ─────────────────────────────────────────────────────────────────────────────
import { generateComplete } from "../llm";
import { articleStatusBadge } from "@/lib/modules/legal-core/article-status";
import type { VerifiedCitation } from "./verifier";

export interface AnalysisResult {
  analysis: string | null; // نصّ التحليل (أو null عند الامتناع)
  abstained: boolean; // امتناع لغياب سند كافٍ
  source: "model" | "offline";
}

/** أقسام الجواب المنهجي الإلزامية (المرحلة ٥) — بهذا الترتيب وبعناوينها. */
export const ANSWER_SECTIONS = [
  "تحرير المسألة",
  "الأنظمة والاتجاهات وأسانيدها",
  "الدفوع المتقابلة",
  "الحكم النظاميّ المطبَّق",
  "الأثر العمليّ",
] as const;

const SYSTEM = [
  "أنت باحث قانوني سعودي. اكتب الجواب **بالبنية الإلزامية** التالية بعناوينها الخمسة نصًّا، بلا زيادة قسمٍ ولا نقصه:",
  `(١) ${ANSWER_SECTIONS[0]}. (٢) ${ANSWER_SECTIONS[1]}. (٣) ${ANSWER_SECTIONS[2]}. (٤) ${ANSWER_SECTIONS[3]}. (٥) ${ANSWER_SECTIONS[4]}.`,
  "ذيّل **كل معلومة** برقم مصدرها بين قوسين [n] مطابقًا لترقيم المواد المُتحقَّقة المرفقة — لا معلومة بلا سند رقميّ.",
  "**انقل الحكم النظاميّ لا رأيًا شخصيًّا**: ممنوع الترجيح الشخصيّ؛ وعند تعدّد الاتجاهات اعرضها منسوبةً لأسانيدها دون انحياز.",
  "**استند حصرًا** إلى المواد المُتحقَّقة المرفقة — لا تذكر مادة غير مرفقة ولا رقمًا غير وارد.",
  "إن كان السؤال **حصريًّا** (أي/كل/جميع/ما هي) فاستقصِ **كل** العناصر المطابقة واعرضها في **جدول شامل** بذيولها الرقمية.",
  "إن رُفِقت **أحكام/مبادئ قضائية داعمة** فاستأنِس بها كسوابق في موضعها، مع بقاء **السند النظاميّ هو المواد**.",
  "أي مادة مَوسومة ⚠️[منسوخة/معدّلة/موقوفة] **نبّه على حالتها صراحةً** ولا تبنِ عليها كأنها سارية.",
  "عربية فصيحة، **أكمِل حتى «الأثر العمليّ»**؛ لا تترك قسمًا أو جملة معلّقة.",
].join(" ");

/** هل يحوي الجواب كل الأقسام الإلزامية الخمسة؟ (فحص بنية — يُستعمل في اختبار المطابقة ٧). */
export function hasAllSections(answer: string): boolean {
  const a = answer ?? "";
  return ANSWER_SECTIONS.every((s) => a.includes(s));
}

/** يستخرج أرقام الذيول [n] المذكورة في الجواب (لفحص «كل ذيل ضمن لوحة الأساس»). */
export function citedFootnotes(answer: string): number[] {
  const out = new Set<number>();
  for (const m of (answer ?? "").matchAll(/\[(\d{1,3})\]/g)) {
    const n = Number(m[1]);
    if (n > 0) out.add(n);
  }
  return [...out];
}

/** يبني كتلة السند المُتحقَّق لتغذية النموذج، مع **وسم الحالة** (منسوخة/معدّلة) صراحةً. */
function groundingBlock(citations: VerifiedCitation[]): string {
  return citations
    .slice(0, 40)
    .map((c, i) => {
      const badge = articleStatusBadge(c.status);
      // نُبرز غير السارية فقط (منسوخة/معدّلة/موقوفة) كي ينتبه التحليل ولا يبني على ملغى.
      const flag = badge && badge.label !== "سارية" ? ` ⚠️[${badge.label}]` : "";
      return `[${i + 1}] ${c.citationLabel}${flag}${c.quote ? `: ${c.quote.slice(0, 400)}` : ""}`;
    })
    .join("\n");
}

/**
 * يحلّل المسألة استنادًا للمواد المُتحقَّقة فقط. لا سند → امتناع صادق (لا تلفيق).
 * يمرّر الأنظمة الحاكمة (المظانّ) كي يربطها التحليل بالمسألة بدل عرضها منفصلة.
 */
export interface SupportingMaterial {
  rulings?: Array<{ title: string; snippet?: string }>;
  principles?: Array<{ title: string; snippet?: string }>;
}

/** يبني كتلة السوابق الداعمة (أحكام/مبادئ) — استئناسية، والسند النظاميّ يبقى المواد. */
function supportingBlock(s?: SupportingMaterial): string {
  if (!s) return "";
  const fmt = (items?: Array<{ title: string; snippet?: string }>) =>
    (items ?? []).slice(0, 6).map((x, i) => `[${i + 1}] ${x.title}${x.snippet ? `: ${x.snippet.slice(0, 220)}` : ""}`).join("\n");
  const r = fmt(s.rulings);
  const p = fmt(s.principles);
  if (!r && !p) return "";
  return [
    r ? `\nأحكام قضائية داعمة (سوابق — استئناس لا سند نظاميّ):\n${r}` : "",
    p ? `\nمبادئ قضائية داعمة:\n${p}` : "",
  ].join("\n");
}

export async function runAnalysis(
  question: string,
  citations: VerifiedCitation[],
  skillContext?: string,
  governingSystems?: string[],
  supporting?: SupportingMaterial
): Promise<AnalysisResult> {
  if (!citations.length) {
    return { analysis: null, abstained: true, source: "offline" }; // الامتناع مطلوب
  }
  const userPrompt = [
    skillContext ? `منهج التدقيق:\n${skillContext}\n` : "",
    `المسألة:\n${question}`,
    governingSystems?.length ? `\nالأنظمة الحاكمة (المظانّ) — اربطها بالمسألة:\n${governingSystems.slice(0, 6).join("، ")}` : "",
    `\nالمواد المُتحقَّقة (السند الوحيد المسموح، ${Math.min(citations.length, 40)} مادة):\n${groundingBlock(citations)}`,
    supportingBlock(supporting),
  ].join("\n");

  const res = await generateComplete(SYSTEM, userPrompt, { maxTokens: 6000, maxRounds: 2 });
  if (res.ok && res.mode === "server" && res.content.trim()) {
    return { analysis: res.content.trim(), abstained: false, source: "model" };
  }
  // سقوط offline: عرض السند المُتحقَّق دون تحليل مولّد (صدق بلا اختراع).
  return { analysis: null, abstained: false, source: "offline" };
}

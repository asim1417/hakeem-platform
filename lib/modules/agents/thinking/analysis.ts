// ─────────────────────────────────────────────────────────────────────────────
// التحليل (المرحلة ٤) — يطابق الأركان بالوقائع، يوازن، يرجّح. يبني حصرًا على مواد مُتحقَّقة.
// يقوده النموذج (callCentralProvider) مع سقوط آمن. يستدعي مهارة التدقيق (المرحلة ٧ تربطها).
// لا يُصدر حكمًا جازمًا في موضع اجتهاد (يُوسم بالاحتمال) — والامتناع عند غياب السند.
// ─────────────────────────────────────────────────────────────────────────────
import { generateComplete } from "../llm";
import type { VerifiedCitation } from "./verifier";

export interface AnalysisResult {
  analysis: string | null; // نصّ التحليل (أو null عند الامتناع)
  abstained: boolean; // امتناع لغياب سند كافٍ
  source: "model" | "offline";
}

const SYSTEM = [
  "أنت محلّل قانوني سعودي. حلّل المسألة بمطابقة الأركان بالوقائع والموازنة والترجيح.",
  "**استند حصرًا** إلى المواد المُتحقَّقة المرفقة — لا تذكر مادة غير مرفقة، ولا رقمًا غير وارد.",
  "في مواضع الاجتهاد استخدم صيغة الاحتمال (يُرجَّح/قد) لا الجزم. اكتب بعربية فصيحة.",
  "**أكمِل التحليل حتى نهايته واختِمه بخلاصة**؛ لا تترك جملة أو ركنًا معلّقًا. وازِن طولك مع اكتمال المعنى.",
].join(" ");

/** يبني كتلة السند المُتحقَّق لتغذية النموذج (لا يُرسَل شيء غير مُتحقَّق). */
function groundingBlock(citations: VerifiedCitation[]): string {
  return citations
    .slice(0, 12)
    .map((c, i) => `[${i + 1}] ${c.citationLabel}${c.quote ? `: ${c.quote.slice(0, 300)}` : ""}`)
    .join("\n");
}

/**
 * يحلّل المسألة استنادًا للمواد المُتحقَّقة فقط. لا سند → امتناع صادق (لا تلفيق).
 */
export async function runAnalysis(
  question: string,
  citations: VerifiedCitation[],
  skillContext?: string
): Promise<AnalysisResult> {
  if (!citations.length) {
    return { analysis: null, abstained: true, source: "offline" }; // الامتناع مطلوب
  }
  const userPrompt = [
    skillContext ? `منهج التدقيق:\n${skillContext}\n` : "",
    `المسألة:\n${question}`,
    `\nالمواد المُتحقَّقة (السند الوحيد المسموح):\n${groundingBlock(citations)}`,
  ].join("\n");

  const res = await generateComplete(SYSTEM, userPrompt, { maxTokens: 6000, maxRounds: 2 });
  if (res.ok && res.mode === "server" && res.content.trim()) {
    return { analysis: res.content.trim(), abstained: false, source: "model" };
  }
  // سقوط offline: عرض السند المُتحقَّق دون تحليل مولّد (صدق بلا اختراع).
  return { analysis: null, abstained: false, source: "offline" };
}

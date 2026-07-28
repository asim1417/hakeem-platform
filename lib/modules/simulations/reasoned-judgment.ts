// محرّك الحكم المُعلَّل المؤصَّل — آليّة النسخة القديمة: حكمٌ حرّ النصّ بالصياغة القضائيّة
// السعوديّة الحقيقيّة (الوقائع ← الأسباب ← المنطوق)، تُناقَش فيه دفوع الطرف المحكوم ضدّه،
// وتُدمَج فيه موادّ النواة المسترجَعة داخل الأسباب مرتبطةً بالوقائع، وينتهي بمنطوقٍ جازمٍ قابلٍ
// للتنفيذ. لا JSON (أمتنُ)، مع قاعدة اكتمالٍ (يُكمِل المنطوق إن انقطع) وحارس اختلاق على النصّ.
// عند تعذّر الحكم المؤصَّل ⇒ يعيد null (فيبيّن المسار أنّ الحكم يتطلّب القاضي الذكيّ — لا قالبَ
// حكمٍ زائف).
import { callCentralProvider } from "@/lib/modules/ai/ai-gateway";
import { groundForJudge, verifyJudgeGrounding } from "./judicial-brain";
import { JUDICIAL_DRAFTING_GUIDE } from "./judicial-drafting";
import { resolveSpecializedAgent } from "./specialized-agents";
import type { ClaimData } from "./hakeem-judge";

export type JudgmentKind = "judgment";

const TRAINING_DISCLAIMER =
  "هذا المستند صادرٌ في بيئة محاكاةٍ تدريبيّة بمنصّة حكيم، ولا يُعدّ حكمًا قضائيًّا نهائيًّا ملزمًا، ولا يُنسب لأيّ جهةٍ قضائيّة رسميّة، ولا يُغني عن مراجعة القاضي المختصّ.";

const PARTY_PLAINTIFF = ["المدعي", "وكيل المدعي"];
const PARTY_DEFENDANT = ["المدعى عليه", "وكيل المدعى عليه"];

function buildSystemPrompt(): string {
  return [
    "أنت قاضٍ في دائرةٍ افتراضيّة تدريبيّة بمنصّة حكيم. أُقفل باب المرافعة، والمطلوب إصدار حكمٍ نهائيٍّ كاملٍ مسبَّب بالصياغة القضائيّة السعوديّة الحقيقيّة.",
    "",
    JUDICIAL_DRAFTING_GUIDE,
    "",
    "== بنية الحكم المطلوبة ==",
    "وحدةٌ واحدة متّصلة بثلاثة أقسام: (أولًا: الوقائع) ← (ثانيًا: الأسباب) ← (ثالثًا: المنطوق).",
    "• الوقائع: لخّص صحيفة الدعوى (الطلبات وسببها وما قُدّم من بيّنة)، ثمّ جواب المدّعى عليه ودفوعه.",
    "• الأسباب (إلزاميّة): ①حرّر محلّ النزاع. ②ناقش دفوع الطرف الذي سيُحكَم ضدّه صراحةً — أورِد كلّ دفعٍ وبيّن وجه ردّه أو قبوله. ③زِن بيّنة كلّ طرفٍ وعبء الإثبات وفق نظام الإثبات. ④ادمج المواد النظاميّة من «الأساس المتاح» أدناه داخل الأسباب مرتبطةً بالواقعة بصيغة «وحيث إنّ المادة (..) من نظام (..) تقضي بأنّ ...، فإنّ الدائرة تنتهي إلى ...».",
    "• المنطوق: جازمٌ محدّدٌ قابلٌ للتنفيذ يبدأ بـ«لذلك حكمت الدائرة بـ...»، وهو واحدٌ من: (إلزام المدّعى عليه بأداءٍ محدّد) أو (رفض الدعوى) أو (عدم قبولها) أو (صرف النظر عنها لعدم تحريرها). ولا يُدرَج فيه أيّ إجراءٍ (يمين/خبير/إحالة/إمهال).",
    "",
    "== قواعد صارمة ==",
    "- لا تستشهد بمادّةٍ ليست في «الأساس النظاميّ المتاح» أدناه، ولا تخترع رقم مادّةٍ أو اسم نظام. إن لم تجد سندًا متّصلًا فاكتب «تطبيقًا للأصول العامّة» دون رقمٍ مختلق.",
    "- لا تدّعِ الاطّلاع على مستندٍ لم يُذكر صراحةً في المداخلات.",
    "- أكمل الحكم حتى آخر سطرٍ من المنطوق والخاتمة، ولا تقطعه.",
    "- اكتب نصّ الحكم مباشرةً بعناوينه العربيّة (أولًا: الوقائع / ثانيًا: الأسباب / ثالثًا: المنطوق) — لا تُخرج JSON ولا أقواسًا برمجيّة. ابدأ مباشرةً بـ«أولًا: الوقائع» (الديباجة والأطراف مُثبتةٌ في الترويسة)."
  ].join("\n");
}

function claimBlock(c?: ClaimData): string {
  return c
    ? [
        `الموضوع: ${c.subject ?? "غير محدد"}`,
        `نوع الدعوى: ${c.caseType ?? "غير محدد"}`,
        `المدّعي: ${c.plaintiffName ?? "غير محدد"}${c.plaintiffCapacity ? " — بصفته " + c.plaintiffCapacity : ""}`,
        `المدّعى عليه: ${c.defendantName ?? "غير محدد"}${c.defendantCapacity ? " — بصفته " + c.defendantCapacity : ""}`,
        `الوقائع: ${c.facts ?? "غير محددة"}`,
        `الطلبات: ${c.requests ?? "غير محددة"}`,
        `الأساس النظاميّ الذي ذكره المدّعي: ${c.legalGrounds ?? "غير مذكور"}`
      ].join("\n")
    : "لم تُسجّل بيانات دعوى مبنيَنة.";
}

function buildUserPrompt(c: ClaimData | undefined, plaintiff: string, defendant: string, citationBlock: string): string {
  return [
    "== بيانات الدعوى (من صحيفة الدعوى المقيّدة) ==",
    claimBlock(c),
    "",
    "== ما قرّره المدّعي ودفوعه ==",
    plaintiff || "لا مداخلات مسجّلة للمدّعي (الدعوى مثبتةٌ من صحيفتها).",
    "",
    "== جواب المدّعى عليه ودفوعه (ناقشها في الأسباب إن حُكم ضدّه) ==",
    defendant || "لا مداخلات مسجّلة للمدّعى عليه.",
    "",
    "== الأساس النظاميّ المتاح (استشهد منه حصرًا) ==",
    citationBlock,
    "",
    "أصدر الحكم النهائيّ الكامل: أولًا الوقائع، ثمّ ثانيًا الأسباب (مع مناقشة دفوع المحكوم ضدّه وإدماج المواد المتاحة)، ثمّ ثالثًا المنطوق الجازم."
  ].join("\n");
}

function isComplete(text: string): boolean {
  return /المنطوق|حكمت الدائرة|لذلك حكمت|لذلك قضت/.test(text);
}

function wrapJudgment(text: string, c: ClaimData | undefined): string {
  const parties = `${c?.plaintiffName || "المدّعي"} ضدّ ${c?.defendantName || "المدّعى عليه"}`;
  return [
    "مسودة حكم قضائيّ مسبَّب — بيئة محاكاة تدريبيّة",
    "بسم الله الرحمن الرحيم",
    `أطراف الدعوى: ${parties}`,
    `نوع الدعوى: ${c?.caseType || "غير محدد"}`,
    "",
    text.trim(),
    "",
    "التنبيه:",
    TRAINING_DISCLAIMER,
    "القاضي حكيم — قاضٍ افتراضيّ تدريبيّ"
  ].join("\n\n");
}

export async function generateReasonedJudgment(input: {
  claim?: ClaimData;
  messages: Array<{ role: string; content: string }>;
}): Promise<{ content: string; grounded: boolean; confidence: number; articleCount: number; kind: JudgmentKind } | null> {
  const plaintiff = input.messages.filter((m) => PARTY_PLAINTIFF.includes(m.role)).map((m) => m.content).join("\n");
  const defendant = input.messages.filter((m) => PARTY_DEFENDANT.includes(m.role)).map((m) => m.content).join("\n");
  const c = input.claim;
  const groundText = [c?.subject, c?.facts, c?.requests, c?.legalGrounds, plaintiff, defendant].filter(Boolean).join(" ");
  if (!groundText.trim()) return null;

  // تأريضٌ بفلسفة «اسأل حكيم» (Claude يقود النطاق + تقييدٌ صلب + ترتيب). بلا أساسٍ لا حكمَ مؤصَّل.
  const agent = resolveSpecializedAgent(c?.caseType);
  const g = await groundForJudge(groundText, 10, agent.scopeSystems);
  if (!g.hasArticles) return null;

  const sys = buildSystemPrompt();
  const usr = buildUserPrompt(c, plaintiff, defendant, g.citationBlock);

  const llm = await callCentralProvider({ systemPrompt: sys, userPrompt: usr, maxTokens: 3600 });
  if (!llm.ok || !llm.content.trim()) return null;
  let text = llm.content.trim();

  // قاعدة الاكتمال: أكمل المنطوق والخاتمة إن انقطع الحكم (كالنسخة القديمة).
  if (!isComplete(text)) {
    const cont = await callCentralProvider({
      systemPrompt: sys,
      userPrompt: `أكمِل الحكم التالي من حيث انتهى، وأصدر «ثالثًا: المنطوق» الجازم والخاتمة فقط، دون إعادة ما سبق:\n«${text.slice(-500)}»`,
      maxTokens: 1200
    });
    if (cont.ok && cont.content.trim()) text = `${text}\n${cont.content.trim()}`;
  }

  // حارس الاختلاق على النصّ كاملًا؛ عند رفض ⇒ إعادةٌ واحدة مشدّدة، ثمّ null (لا قالبَ زائف).
  if (!verifyJudgeGrounding([text], g.allowedNumbers)) {
    const retry = await callCentralProvider({
      systemPrompt: sys,
      userPrompt: `${usr}\n\nتنبيهٌ صارم: لا تذكر أيّ رقم مادّةٍ إلا ما ورد نصًّا في «الأساس النظاميّ المتاح» أعلاه؛ واحذف أيّ إشارةٍ لأرقام موادَّ غير مذكورةٍ فيه.`,
      maxTokens: 3600
    });
    if (!retry.ok || !retry.content.trim() || !verifyJudgeGrounding([retry.content], g.allowedNumbers)) return null;
    text = retry.content.trim();
  }

  return {
    content: wrapJudgment(text, c),
    grounded: g.allowedNumbers.size > 0,
    confidence: g.articleCount > 0 ? 0.75 : 0.4,
    articleCount: g.articleCount,
    kind: "judgment"
  };
}

// محرّك الحكم المُعلَّل المؤصَّل — يرفع «القاضي التفاعليّ» من قالبِ حكمٍ ثابت إلى حكمٍ
// يُعلِّل ويزن بيّنة كلّ طرفٍ وفق عبء الإثبات، ثمّ يصدر منطوقًا محدّدًا وأسبابًا مستندة
// لمواد حقيقيّة من النواة (بحارس اختلاق). كلّ استشهادٍ قابلٌ للتتبّع لسجلّ DB.
// عند أيّ فشلٍ أو خروجٍ عن التأريض ⇒ يعيد null فيسقط المسار للقالب الآمن (لا كسر).
import { callCentralProvider } from "@/lib/modules/ai/ai-gateway";
import { collectStrings } from "@/lib/modules/grounding/verify-guard";
import { groundForJudge, verifyJudgeGrounding } from "./judicial-brain";
import type { ClaimData } from "./hakeem-judge";

const TRAINING_DISCLAIMER =
  "هذا المستند صادرٌ في بيئة محاكاةٍ تدريبيّة بمنصّة حكيم، ولا يُعدّ حكمًا قضائيًّا نهائيًّا ملزمًا، ولا يُغني عن مراجعة القاضي المختصّ. المخرَج تحليليٌّ مؤصَّلٌ، والتقدير النهائيّ مرهونٌ بكامل ملفّ الدعوى ومستنداتها.";

type ReasonedJudgment = {
  issue?: string; // المسألة محلّ الفصل
  characterization?: string; // التكييف القانونيّ للنزاع
  burdenOfProof?: string; // على من يقع عبء الإثبات
  plaintiffEvidence?: string; // وزن بيّنة المدّعي
  defendantEvidence?: string; // وزن دفوع/بيّنة المدّعى عليه
  reasoning?: string; // الأسباب
  verdict?: string; // المنطوق
  confidence?: number; // 0..1
  insufficient?: boolean; // امتناعٌ لنقص الدليل
  citations?: string[];
};

const PARTY_PLAINTIFF = ["المدعي", "وكيل المدعي"];
const PARTY_DEFENDANT = ["المدعى عليه", "وكيل المدعى عليه"];

function extractJson(raw: string): ReasonedJudgment | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1)) as ReasonedJudgment;
  } catch {
    return null;
  }
}

function buildSystemPrompt() {
  return [
    "أنت قاضٍ افتراضيّ تدريبيّ في منصّة حكيم. أُقفل باب المرافعة، والمطلوب إصدار حكمٍ مسبَّب.",
    "منهجك القضائيّ الإلزاميّ بالترتيب:",
    "١) حدّد المسألة محلّ الفصل بدقّة. ٢) كيّف النزاع قانونيًّا. ٣) بيّن على من يقع عبء الإثبات وفق نظام الإثبات.",
    "٤) زِن بيّنة المدّعي ثمّ دفوع/بيّنة المدّعى عليه: هل أوفى كلٌّ بما يلزمه إثباته؟ ٥) رتّب الأسباب. ٦) أصدر المنطوق.",
    "قواعد صارمة:",
    "- لا تختلق مادّةً ولا رقم مادّة؛ لا تستشهد إلا بالمواد المذكورة في «الأساس النظاميّ المتاح» أدناه.",
    "- ابنِ النتيجة على من أوفى بعبء إثباته فعلًا من واقع المداخلات — لا على انطباعٍ عامّ.",
    "- إن لم تكفِ الأدلّة أو الوقائع لحكمٍ منضبط، فاضبط insufficient=true وامتنع عن منطوقٍ قاطع.",
    "أعِد الجواب بصيغة JSON فقط بالمفاتيح:",
    '{"issue":"","characterization":"","burdenOfProof":"","plaintiffEvidence":"","defendantEvidence":"","reasoning":"","verdict":"","confidence":0.0,"insufficient":false,"citations":["نظام ... المادة ..."]}',
    "verdict = المنطوق بصيغةٍ قضائيّة محدّدة. citations = أرقام موادّ من المتاح فقط."
  ].join("\n");
}

function buildUserPrompt(claim: ClaimData | undefined, plaintiff: string, defendant: string, citationBlock: string) {
  const claimBlock = claim
    ? [
        `الموضوع: ${claim.subject ?? "غير محدد"}`,
        `نوع الدعوى: ${claim.caseType ?? "غير محدد"}`,
        `الوقائع: ${claim.facts ?? "غير محددة"}`,
        `الطلبات: ${claim.requests ?? "غير محددة"}`,
        `الأساس النظاميّ الذي ذكره المدّعي: ${claim.legalGrounds ?? "غير مذكور"}`
      ].join("\n")
    : "لم تُسجّل بيانات دعوى مبنيَنة.";
  return [
    "== بيانات الدعوى ==",
    claimBlock,
    "",
    "== مداخلات المدّعي ودفوعه ==",
    plaintiff || "لا مداخلات مسجّلة للمدّعي.",
    "",
    "== مداخلات المدّعى عليه ودفوعه ==",
    defendant || "لا مداخلات مسجّلة للمدّعى عليه.",
    "",
    "== الأساس النظاميّ المتاح (استشهد منه حصرًا) ==",
    citationBlock,
    "",
    "أصدر الحكم المسبَّب بصيغة JSON وفق المنهج المذكور."
  ].join("\n");
}

function section(title: string, body?: string) {
  return body && body.trim() ? `${title}\n${body.trim()}` : null;
}

function formatJudgment(j: ReasonedJudgment, claim: ClaimData | undefined, citationBlock: string): string {
  const parties = `${claim?.plaintiffName || "المدّعي"} ضدّ ${claim?.defendantName || "المدّعى عليه"}`;
  const verdict = j.insufficient
    ? "لعدم كفاية ما قُدّم من بيّنات ووقائع للفصل الموضوعيّ في بيئة المحاكاة، يُوقف التقدير النهائيّ إلى حين استكمال الأدلّة والمستندات النظاميّة."
    : j.verdict || "لم يتحرّر منطوقٌ كافٍ من المعطيات.";
  return [
    "مسودة حكم قضائيّ مسبَّب — بيئة محاكاة تدريبيّة",
    "بسم الله الرحمن الرحيم",
    `أطراف الدعوى: ${parties}`,
    `نوع الدعوى: ${claim?.caseType || "غير محدد"}`,
    section("أولًا: المسألة محلّ الفصل", j.issue),
    section("ثانيًا: التكييف القانونيّ", j.characterization),
    section("ثالثًا: عبء الإثبات", j.burdenOfProof),
    section("رابعًا: وزن بيّنة المدّعي", j.plaintiffEvidence),
    section("خامسًا: وزن دفوع المدّعى عليه", j.defendantEvidence),
    section("سادسًا: الأسباب", j.reasoning),
    `سابعًا: المنطوق\n${verdict}`,
    section("ثامنًا: الأساس النظاميّ المسترجَع من النواة", citationBlock),
    `تاسعًا: درجة الثقة التقديريّة: ${Math.round((Number(j.confidence) || 0) * 100)}٪`,
    "عاشرًا: التنبيه",
    TRAINING_DISCLAIMER,
    "القاضي حكيم — قاضٍ افتراضيّ تدريبيّ"
  ]
    .filter(Boolean)
    .join("\n\n");
}

export async function generateReasonedJudgment(input: {
  claim?: ClaimData;
  messages: Array<{ role: string; content: string }>;
}): Promise<{ content: string; grounded: boolean; confidence: number; articleCount: number } | null> {
  const plaintiff = input.messages.filter((m) => PARTY_PLAINTIFF.includes(m.role)).map((m) => m.content).join("\n");
  const defendant = input.messages.filter((m) => PARTY_DEFENDANT.includes(m.role)).map((m) => m.content).join("\n");
  const c = input.claim;
  const groundText = [c?.subject, c?.facts, c?.requests, c?.legalGrounds, plaintiff, defendant].filter(Boolean).join(" ");
  if (!groundText.trim()) return null;

  const g = await groundForJudge(groundText, 8);

  const llm = await callCentralProvider({
    systemPrompt: buildSystemPrompt(),
    userPrompt: buildUserPrompt(c, plaintiff, defendant, g.citationBlock),
    maxTokens: 2600
  });
  if (!llm.ok || !llm.content.trim()) return null;

  const parsed = extractJson(llm.content);
  if (!parsed) return null;

  // حارس التأريض: أيّ رقم مادّة في الحكم ليس ضمن المسترجَع ⇒ رفض والسقوط للقالب.
  if (!verifyJudgeGrounding(collectStrings(parsed), g.allowedNumbers)) return null;

  return {
    content: formatJudgment(parsed, c, g.citationBlock),
    grounded: g.allowedNumbers.size > 0,
    confidence: Number(parsed.confidence) || 0,
    articleCount: g.articleCount
  };
}

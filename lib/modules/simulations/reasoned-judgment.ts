// محرّك الحكم المُعلَّل المؤصَّل — يرفع «القاضي التفاعليّ» من قالبِ حكمٍ ثابت إلى حكمٍ
// يُعلِّل ويزن بيّنة كلّ طرفٍ وفق عبء الإثبات، ثمّ يصدر منطوقًا محدّدًا وأسبابًا مستندة
// لمواد حقيقيّة من النواة (بحارس اختلاق). كلّ استشهادٍ قابلٌ للتتبّع لسجلّ DB.
// عند أيّ فشلٍ أو خروجٍ عن التأريض ⇒ يعيد null فيسقط المسار للقالب الآمن (لا كسر).
//
// ضُمّت إليه خصائص «النسخة السابقة» (القاعة الكلاسيكيّة) في الصياغة القضائيّة السعوديّة:
//   • بنية الحكم وحدةٌ واحدة: الوقائع ← الأسباب ← المنطوق، بعباراتٍ جازمة محايدة موجزة.
//   • المنطوق حصراً فصلٌ نهائيّ (إلزام/رفض/عدم قبول/صرف نظر)؛ ويُمنع إقحام أيّ إجراءٍ فيه.
//   • تمييز القرار الإجرائيّ عن الحكم: توجيه اليمين الحاسمة/ندب الخبير/الاستكمال قراراتٌ
//     إجرائيّة تُتّخذ قبل الحكم لا تُخلط بالمنطوق؛ فإن توقّف الفصل عليها صدر «قرارٌ إجرائيّ»
//     يُحيل القضية لجلسةٍ لاحقة، لا حكمٌ نهائيّ.
import { callCentralProvider } from "@/lib/modules/ai/ai-gateway";
import { collectStrings } from "@/lib/modules/grounding/verify-guard";
import { groundForJudge, verifyJudgeGrounding, PROCEDURAL_DIGEST } from "./judicial-brain";
import { JUDICIAL_DRAFTING_GUIDE } from "./judicial-drafting";
import { resolveSpecializedAgent } from "./specialized-agents";
import type { ClaimData } from "./hakeem-judge";

const TRAINING_DISCLAIMER =
  "هذا المستند صادرٌ في بيئة محاكاةٍ تدريبيّة بمنصّة حكيم، ولا يُعدّ حكمًا قضائيًّا نهائيًّا ملزمًا، ولا يُغني عن مراجعة القاضي المختصّ. المخرَج تحليليٌّ مؤصَّلٌ، والتقدير النهائيّ مرهونٌ بكامل ملفّ الدعوى ومستنداتها.";

type ReasonedJudgment = {
  issue?: string; // المسألة محلّ الفصل
  characterization?: string; // التكييف القانونيّ للنزاع
  burdenOfProof?: string; // على من يقع عبء الإثبات
  plaintiffEvidence?: string; // وزن بيّنة المدّعي
  defendantEvidence?: string; // وزن دفوع/بيّنة المدّعى عليه
  reasoning?: string; // الأسباب (تُدمَج فيها المواد مرتبطةً بالوقائع)
  verdict?: string; // المنطوق النهائيّ (فصلٌ نهائيّ فقط)
  disposition?: string; // نوع الفصل: إلزام | رفض | عدم قبول | صرف نظر
  confidence?: number; // 0..1
  insufficient?: boolean; // امتناعٌ لنقص الدليل (دون بلوغ إجراءٍ محدّد)
  // ── تمييز القرار الإجرائيّ عن الحكم ──
  procedural?: boolean; // الفصل يتوقّف على إجراءٍ لم يُستكمَل ⇒ قرارٌ إجرائيّ لا حكم
  proceduralKind?: string; // توجيه يمين حاسمة | ندب خبير | استكمال بيّنة | إمهال
  proceduralDecision?: string; // نصّ القرار الإجرائيّ بصيغةٍ قضائيّة
  oathParty?: string; // الطرف الموجَّهة إليه اليمين (إن كان الإجراء يمينًا)
  oathFormula?: string; // صيغة اليمين الحاسمة
  citations?: string[];
};

export type JudgmentKind = "judgment" | "procedural";

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

// دليلُ الصياغة القضائيّة السعوديّة — منقولٌ من خصائص النسخة السابقة (القاعة الكلاسيكيّة).
function buildSystemPrompt() {
  return [
    "أنت قاضٍ افتراضيّ تدريبيّ في منصّة حكيم، تعمل وفق الدليل الموحَّد للصياغة القضائيّة السعوديّة.",
    "أُقفل باب المرافعة، والمطلوب إصدار مخرَجٍ قضائيٍّ مسبَّب.",
    "",
    PROCEDURAL_DIGEST,
    "",
    JUDICIAL_DRAFTING_GUIDE,
    "",
    "== القاعدة العامّة للصياغة ==",
    "- الحكم بنيةٌ واحدة مترابطة: الوقائع ← الأسباب ← المنطوق؛ كلّ فقرةٍ تترتّب على ما قبلها.",
    "- عبارتك قضائيّةٌ مرتّبة محايدة موجزة جازمة. ابدأ فقرات الأسباب بـ«وحيث إنّ…»، والمنطوق بـ«لذلك حكمت الدائرة…».",
    "- يُمنع منعًا باتًّا استعمال: أرى، يبدو، غالبًا، أنصح، من الأفضل، ربّما. ولا تُصدر حكمًا بصيغةٍ غير جازمة.",
    "- لا تدّعِ الاطّلاع على مستندٍ لم يُذكر صراحةً في مداخلات الجلسة؛ فما لم يُقدَّم نصًّا فهو غير موجود.",
    "",
    "== المنهج القضائيّ الإلزاميّ بالترتيب ==",
    "١) حدّد المسألة محلّ الفصل بدقّة. ٢) كيّف النزاع قانونيًّا. ٣) بيّن على من يقع عبء الإثبات وفق نظام الإثبات (الأصل: البيّنة على من ادّعى واليمين على من أنكر).",
    "٤) زِن بيّنة المدّعي ثمّ دفوع/بيّنة المدّعى عليه: هل أوفى كلٌّ بما يلزمه إثباته فعلًا من واقع المداخلات؟ ٥) رتّب الأسباب. ٦) أصدر المنطوق أو القرار الإجرائيّ المناسب.",
    "",
    "== تأصيل الأسباب (إدماج المواد لا سردها) ==",
    "- ادمج كلّ مادّةٍ داخل فقرة الأسباب مرتبطةً بالواقعة التي تستدلّ بها عليها (مثال: «وحيث ثبت [الواقعة]، وكانت المادّة (..) من نظام (..) تقضي بأنّ [الحكم]، فإنّ الدائرة تنتهي إلى [النتيجة]»).",
    "- لا تختلق مادّةً ولا رقم مادّة؛ لا تستشهد إلا بالمواد المذكورة في «الأساس النظاميّ المتاح» أدناه.",
    "- استند إلى نظام الإثبات فيما يتّصل بعبء الإثبات والبيّنة واليمين متى توفّر في المتاح، ولا تحشُر موادَّ لا صلة لها بوقائع النزاع.",
    "",
    "== أوزان الأدلّة ==",
    "- عقدٌ موقَّع = حجّةٌ كاملة على الالتزام. حوالةٌ بنكيّة = حجّةٌ على انتقال المبلغ لا على سببه. فاتورةٌ من طرفٍ واحد = لا تكفي وحدها.",
    "- محضر استلامٍ موقَّع = إثبات التسليم. إقرارٌ أمام المحكمة = حجّةٌ قاطعة على المُقِرّ. القرينة تُستنتج من واقعةٍ مذكورةٍ فعلًا لا من فراغ.",
    "",
    "== قاعدة المنطوق (صارمة) ==",
    "- المنطوق حصرًا فصلٌ نهائيٌّ واحدٌ من: (إلزام المدّعى عليه بأداءٍ محدّد قابلٍ للتنفيذ) أو (رفض الدعوى) أو (عدم قبول الدعوى) أو (صرف النظر عن الدعوى لعدم تحريرها).",
    "- يُمنع منعًا باتًّا إدراج (توجيه اليمين الحاسمة، ندب خبير، الإمهال، استكمال البيّنة، التأجيل، الإحالة لجلسةٍ لاحقة) داخل المنطوق؛ فهذه قراراتٌ إجرائيّةٌ سابقةٌ على الحكم لا تُخلط به.",
    "",
    "== بوابة القرار الإجرائيّ (تمييزه عن الحكم) ==",
    "- إن كان الفصل الموضوعيّ يتوقّف على إجراءٍ لم يُستكمَل — ولا سيّما إذا عجز المدّعي عن البيّنة وطلب توجيه اليمين الحاسمة إلى المدّعى عليه، أو لزم ندب خبيرٍ في مسألةٍ فنّيّة — فلا تُصدر حكمًا نهائيًّا.",
    "- في هذه الحال اضبط procedural=true، واترك verdict فارغًا، وحرّر proceduralDecision قرارًا إجرائيًّا واحدًا بصيغةٍ قضائيّة (مثال: «قرّرت الدائرة توجيه اليمين الحاسمة إلى المدّعى عليه»)، وحدّد proceduralKind، وإن كان يمينًا فاملأ oathParty وصِغ oathFormula بصيغة: «واللهِ العظيم إنّي [نفي واقعة الدعوى محلّ المطالبة]».",
    "- القرار الإجرائيّ يُحيل القضية لجلسةٍ لاحقة لتنفيذ الإجراء، ولا يتضمّن منطوقًا نهائيًّا ولا يقضي في الموضوع.",
    "",
    "أعِد الجواب بصيغة JSON فقط بالمفاتيح:",
    '{"issue":"","characterization":"","burdenOfProof":"","plaintiffEvidence":"","defendantEvidence":"","reasoning":"","disposition":"إلزام|رفض|عدم قبول|صرف نظر","verdict":"","confidence":0.0,"insufficient":false,"procedural":false,"proceduralKind":"","proceduralDecision":"","oathParty":"","oathFormula":"","citations":["نظام ... المادة ..."]}',
    "verdict = المنطوق النهائيّ (يُملأ فقط حين procedural=false). citations = أرقام موادّ من المتاح فقط."
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
    "أصدر المخرَج المسبَّب بصيغة JSON وفق المنهج المذكور: فإن جهُز الفصل فأصدر حكمًا بمنطوقٍ نهائيّ، وإن توقّف على إجراءٍ (كتوجيه اليمين الحاسمة) فأصدر قرارًا إجرائيًّا دون منطوق."
  ].join("\n");
}

function section(title: string, body?: string) {
  return body && body.trim() ? `${title}\n${body.trim()}` : null;
}

// ── تنسيق القرار الإجرائيّ (لا حكم): يُميَّز عنوانًا ومضمونًا عن مسودة الحكم ──
function formatProcedural(j: ReasonedJudgment, claim: ClaimData | undefined, citationBlock: string): string {
  const parties = `${claim?.plaintiffName || "المدّعي"} ضدّ ${claim?.defendantName || "المدّعى عليه"}`;
  const oathLine =
    j.oathFormula && j.oathFormula.trim()
      ? `صيغة اليمين: «${j.oathFormula.trim()}»${j.oathParty ? ` — توجَّه إلى: ${j.oathParty.trim()}` : ""}`
      : null;
  const decision =
    (j.proceduralDecision && j.proceduralDecision.trim()) ||
    "قرّرت الدائرة اتّخاذ الإجراء اللازم قبل الفصل في الموضوع.";
  return [
    "قرارٌ إجرائيٌّ في جلسة المحاكاة — بيئة محاكاة تدريبيّة",
    "بسم الله الرحمن الرحيم",
    `أطراف الدعوى: ${parties}`,
    `نوع الدعوى: ${claim?.caseType || "غير محدد"}`,
    j.proceduralKind ? `نوع الإجراء: ${j.proceduralKind}` : null,
    section("أولًا: المسألة محلّ الفصل", j.issue),
    section("ثانيًا: التكييف القانونيّ", j.characterization),
    section("ثالثًا: عبء الإثبات", j.burdenOfProof),
    section("رابعًا: حال البيّنة وسبب عدم جهوزيّة الفصل", [j.plaintiffEvidence, j.defendantEvidence].filter(Boolean).join("\n")),
    ["خامسًا: القرار الإجرائيّ", decision, oathLine].filter(Boolean).join("\n"),
    "سادسًا: الأثر الإجرائيّ\nتُحال القضية إلى جلسةٍ لاحقة لتنفيذ هذا الإجراء، ولا يصدر منطوقٌ نهائيّ في الموضوع قبل استكماله.",
    section("سابعًا: الأساس النظاميّ المستند إليه", citationBlock),
    "ثامنًا: التنبيه",
    TRAINING_DISCLAIMER,
    "القاضي حكيم — قاضٍ افتراضيّ تدريبيّ"
  ]
    .filter(Boolean)
    .join("\n\n");
}

// ── تنسيق الحكم النهائيّ (منطوقٌ فاصل) ──
function formatJudgment(j: ReasonedJudgment, claim: ClaimData | undefined, citationBlock: string): string {
  const parties = `${claim?.plaintiffName || "المدّعي"} ضدّ ${claim?.defendantName || "المدّعى عليه"}`;
  const verdict = j.insufficient
    ? "لعدم كفاية ما قُدّم من بيّنات ووقائع للفصل الموضوعيّ في بيئة المحاكاة، حكمت الدائرة برفض الدعوى لعجز المدّعي عن إثباتها، مع بقاء التقدير النهائيّ مرهونًا بكامل ملفّ الدعوى ومستنداتها."
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
    section("ثامنًا: الأساس النظاميّ المستند إليه", citationBlock),
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
}): Promise<{ content: string; grounded: boolean; confidence: number; articleCount: number; kind: JudgmentKind } | null> {
  const plaintiff = input.messages.filter((m) => PARTY_PLAINTIFF.includes(m.role)).map((m) => m.content).join("\n");
  const defendant = input.messages.filter((m) => PARTY_DEFENDANT.includes(m.role)).map((m) => m.content).join("\n");
  const c = input.claim;
  // إشاراتٌ إجرائيّة تُبرز نظام الإثبات في الاسترجاع (عبء الإثبات · البيّنة · اليمين الحاسمة).
  const proceduralAnchors = "عبء الإثبات البيّنة على من ادّعى واليمين على من أنكر اليمين الحاسمة وسائل الإثبات في نظام الإثبات";
  const groundText = [c?.subject, c?.facts, c?.requests, c?.legalGrounds, plaintiff, defendant, proceduralAnchors]
    .filter(Boolean)
    .join(" ");
  if (!groundText.trim()) return null;

  const agent = resolveSpecializedAgent(c?.caseType);
  const g = await groundForJudge(groundText, 8, agent.scopeSystems);

  const llm = await callCentralProvider({
    systemPrompt: buildSystemPrompt(),
    userPrompt: buildUserPrompt(c, plaintiff, defendant, g.citationBlock),
    maxTokens: 2800
  });
  if (!llm.ok || !llm.content.trim()) return null;

  const parsed = extractJson(llm.content);
  if (!parsed) return null;

  // حارس التأريض: أيّ رقم مادّة في المخرَج ليس ضمن المسترجَع ⇒ رفض والسقوط للقالب.
  if (!verifyJudgeGrounding(collectStrings(parsed), g.allowedNumbers)) return null;

  // تمييز المخرَج: قرارٌ إجرائيّ (لا منطوق) أم حكمٌ نهائيّ.
  const isProcedural = parsed.procedural === true || Boolean((parsed.proceduralDecision || "").trim());
  const content = isProcedural
    ? formatProcedural(parsed, c, g.citationBlock)
    : formatJudgment(parsed, c, g.citationBlock);

  return {
    content,
    grounded: g.allowedNumbers.size > 0,
    confidence: isProcedural ? 0 : Number(parsed.confidence) || 0,
    articleCount: g.articleCount,
    kind: isProcedural ? "procedural" : "judgment"
  };
}

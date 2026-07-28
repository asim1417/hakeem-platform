// مهارات إجراءات المحاكمة — سطحٌ موحَّدٌ لستّ مهاراتٍ مؤصَّلة تغطّي كامل المسار القضائيّ.
// كلّها تشترك في نواة التأريض نفسها المستعملة في «اسأل حكيم» (groundForJudge ← buildLegalContextForAI)
// + حارس الاختلاق (verifyJudgeGrounding)، فلا منطق موازٍ ولا اختلاق. عند أيّ فشلٍ أو خروجٍ عن
// التأريض تعيد المهارة null فيسقط المسار لبديلٍ آمن (لا كسر).
//
// المهارات الستّ:
//   ① فحص القبول   assessAdmissibility   (جديد — مؤصَّل)
//   ② إدارة المرافعة managePleading        (القائم: ai-judge)
//   ③ تقدير البيّنة  evaluateEvidence      (جديد — مؤصَّل بنظام الإثبات)
//   ④ تيسير الصلح   facilitateSettlement  (جديد — مؤصَّل، بدل القالب)
//   ⑤ صياغة الحكم   writeJudgment         (القائم: reasoned-judgment)
//   ⑥ تحليل الاعتراض analyzeObjection      (جديد — مؤصَّل، بدل الـstub)
import { callCentralProvider } from "@/lib/modules/ai/ai-gateway";
import { collectStrings } from "@/lib/modules/grounding/verify-guard";
import { groundForJudge, verifyJudgeGrounding, PROCEDURAL_DIGEST } from "./judicial-brain";
import { OBJECTION_FORMULAS, JUDICIAL_DRAFTING_GUIDE } from "./judicial-drafting";
import { resolveSpecializedAgent } from "./specialized-agents";
import type { ClaimData } from "./hakeem-judge";

// توحيد السطح: المهارتان القائمتان تُعادان تصديرهما من هنا (مصدرٌ واحدٌ لكلّ المهارات).
export { decideJudgeTurnAI as managePleading } from "./ai-judge";
export { generateReasonedJudgment as writeJudgment } from "./reasoned-judgment";

const PARTY_PLAINTIFF = ["المدعي", "وكيل المدعي"];
const PARTY_DEFENDANT = ["المدعى عليه", "وكيل المدعى عليه"];
const DISCLAIMER = "مخرَجٌ تدريبيٌّ مؤصَّلٌ في منصّة حكيم، لا يُعدّ إجراءً قضائيًّا نهائيًّا ملزمًا.";

type Msg = { role: string; content: string };

function extractJson<T>(raw: string): T | null {
  const s = raw.indexOf("{");
  const e = raw.lastIndexOf("}");
  if (s < 0 || e <= s) return null;
  try {
    return JSON.parse(raw.slice(s, e + 1)) as T;
  } catch {
    return null;
  }
}

function partyText(messages: Msg[], roles: string[]) {
  return messages.filter((m) => roles.includes(m.role)).map((m) => m.content).join("\n");
}

function claimBlock(c?: ClaimData) {
  return c
    ? [
        `الموضوع: ${c.subject ?? "غير محدد"}`,
        `نوع الدعوى: ${c.caseType ?? "غير محدد"}`,
        `الوقائع: ${c.facts ?? "غير محددة"}`,
        `الطلبات: ${c.requests ?? "غير محددة"}`,
        `الأساس النظاميّ المذكور: ${c.legalGrounds ?? "غير مذكور"}`
      ].join("\n")
    : "لم تُسجّل بيانات دعوى مبنيَنة.";
}

/** النواة المشتركة: تأريضٌ من نواة «اسأل حكيم» + توليد + حارس اختلاق. تعيد JSON مؤصَّلًا أو null. */
async function runGroundedSkill<T extends object>(spec: {
  groundText: string;
  systemPrompt: string;
  buildUser: (citationBlock: string) => string;
  maxTokens?: number;
  /** نوع الدعوى — لتفعيل نطاق التخصّص المناسب في التأريض. */
  caseType?: string;
}): Promise<{ data: T; grounded: boolean } | null> {
  if (!spec.groundText.trim()) return null;
  const agent = resolveSpecializedAgent(spec.caseType);
  const g = await groundForJudge(spec.groundText, 8, agent.scopeSystems);
  const llm = await callCentralProvider({
    // استيعاب الأنظمة الإجرائيّة الأربعة يتصدّر كلّ مهارةٍ قضائيّة (نطاقٌ مؤرَّض + منهجٌ إجرائيّ).
    systemPrompt: `${PROCEDURAL_DIGEST}\n\n${spec.systemPrompt}`,
    userPrompt: spec.buildUser(g.citationBlock),
    maxTokens: spec.maxTokens ?? 1800
  });
  if (!llm.ok || !llm.content.trim()) return null;
  const data = extractJson<T>(llm.content);
  if (!data) return null;
  if (!verifyJudgeGrounding(collectStrings(data), g.allowedNumbers)) return null;
  return { data, grounded: g.allowedNumbers.size > 0 };
}

function sec(title: string, body?: string) {
  return body && String(body).trim() ? `${title}\n${String(body).trim()}` : null;
}

// ─────────────────────────── ① فحص القبول ───────────────────────────
type AdmissibilityOut = { jurisdiction?: string; capacityInterest?: string; formalConditions?: string; verdict?: string; citations?: string[] };

export async function assessAdmissibility(claim?: ClaimData): Promise<{ content: string; grounded: boolean } | null> {
  const res = await runGroundedSkill<AdmissibilityOut>({
    groundText: `${claim?.subject ?? ""} ${claim?.facts ?? ""} الاختصاص النوعيّ والمكانيّ وشروط قبول الدعوى والصفة والمصلحة وصحيفة الدعوى`,
    caseType: claim?.caseType,
    systemPrompt: [
      "أنت قاضٍ افتراضيّ تدريبيّ يفحص قبول الدعوى شكلًا قبل الموضوع.",
      "قيّم: الاختصاص (النوعيّ والمكانيّ)، الصفة والمصلحة، الشروط الشكليّة لصحيفة الدعوى.",
      "لا تختلق مادّة؛ استشهد فقط بالمواد المتاحة أدناه. أعِد JSON فقط بالمفاتيح:",
      '{"jurisdiction":"","capacityInterest":"","formalConditions":"","verdict":"مقبولة شكلًا / غير مقبولة / بحاجة استكمال","citations":[]}'
    ].join("\n"),
    buildUser: (cb) => [`== بيانات الدعوى ==`, claimBlock(claim), "", "== الأساس النظاميّ المتاح ==", cb, "", "افحص القبول شكلًا بصيغة JSON."].join("\n")
  });
  if (!res) return null;
  const d = res.data;
  return {
    grounded: res.grounded,
    content: [
      "فحص قبول الدعوى (شكلًا)",
      sec("الاختصاص", d.jurisdiction),
      sec("الصفة والمصلحة", d.capacityInterest),
      sec("الشروط الشكليّة", d.formalConditions),
      sec("الخلاصة", d.verdict),
      sec("الأساس النظاميّ", d.citations?.join("، ")),
      DISCLAIMER
    ].filter(Boolean).join("\n\n")
  };
}

// ─────────────────────────── ③ تقدير البيّنة ───────────────────────────
type EvidenceOut = { burdenOfProof?: string; plaintiffEvidence?: string; defendantEvidence?: string; sufficiency?: string; citations?: string[] };

export async function evaluateEvidence(claim: ClaimData | undefined, messages: Msg[]): Promise<{ content: string; grounded: boolean } | null> {
  const plaintiff = partyText(messages, PARTY_PLAINTIFF);
  const defendant = partyText(messages, PARTY_DEFENDANT);
  const res = await runGroundedSkill<EvidenceOut>({
    groundText: `${claim?.subject ?? ""} ${claim?.facts ?? ""} ${plaintiff} ${defendant}`,
    caseType: claim?.caseType,
    systemPrompt: [
      "أنت قاضٍ افتراضيّ تدريبيّ يقدّر البيّنة وفق نظام الإثبات.",
      "بيّن على من يقع عبء الإثبات، ثمّ زِن ما قدّمه كلّ طرف (حجّية المستند/الشهادة/اليمين/القرينة/الإقرار)، ثمّ اخلص لكفاية الإثبات من عدمها.",
      "لا تختلق مادّة؛ استشهد فقط بالمواد المتاحة. أعِد JSON فقط:",
      '{"burdenOfProof":"","plaintiffEvidence":"","defendantEvidence":"","sufficiency":"","citations":[]}'
    ].join("\n"),
    buildUser: (cb) => [
      "== الدعوى ==", claimBlock(claim), "",
      "== ما قدّمه المدّعي ==", plaintiff || "لا شيء", "",
      "== ما قدّمه المدّعى عليه ==", defendant || "لا شيء", "",
      "== الأساس النظاميّ المتاح ==", cb, "", "قدّر البيّنة بصيغة JSON."
    ].join("\n")
  });
  if (!res) return null;
  const d = res.data;
  return {
    grounded: res.grounded,
    content: [
      "تقدير البيّنة وعبء الإثبات",
      sec("عبء الإثبات", d.burdenOfProof),
      sec("وزن بيّنة المدّعي", d.plaintiffEvidence),
      sec("وزن بيّنة المدّعى عليه", d.defendantEvidence),
      sec("كفاية الإثبات", d.sufficiency),
      sec("الأساس النظاميّ", d.citations?.join("، ")),
      DISCLAIMER
    ].filter(Boolean).join("\n\n")
  };
}

// ─────────────────────────── ④ تيسير الصلح ───────────────────────────
// (مطوَّرٌ من settAnswer/analyzeSettlement الكلاسيكيّ): يقارن مقترحَي الطرفين، يقيس الفجوة،
// ويوصي بالقبول أو المضي، مع بنود تسويةٍ عادلة مؤصَّلة.
type SettlementOut = { commonGround?: string; gapAnalysis?: string; proposedTerms?: string; obligations?: string; recommendation?: string; caution?: string; citations?: string[] };

export async function facilitateSettlement(
  claim: ClaimData | undefined,
  messages: Msg[],
  inputs: { amount?: string; obligations?: string; duration?: string; waiver?: string; plaintiffProposal?: string; defendantProposal?: string }
): Promise<{ content: string; grounded: boolean } | null> {
  const hasDual = Boolean(inputs.plaintiffProposal?.trim() || inputs.defendantProposal?.trim());
  const res = await runGroundedSkill<SettlementOut>({
    groundText: `${claim?.subject ?? ""} ${claim?.facts ?? ""} الصلح والتسوية وإنهاء النزاع وديًّا`,
    caseType: claim?.caseType,
    systemPrompt: [
      "أنت قاضٍ افتراضيّ تدريبيّ يُيسّر الصلح بين الطرفين بحيادٍ تامّ.",
      "قارن مقترح المدّعي بمقترح المدّعى عليه: هل يتقاطعان؟ ما حجم الفجوة؟ ثمّ استخلص نقاط الالتقاء، واقترح بنود تسويةٍ عادلة، وأوصِ صراحةً بالقبول أو المضي في الدعوى، وبيّن أثر الصلح النظاميّ.",
      "لا تفرض على طرفٍ ولا تختلق مادّة. أعِد JSON فقط:",
      '{"commonGround":"","gapAnalysis":"","proposedTerms":"","obligations":"","recommendation":"","caution":"","citations":[]}'
    ].join("\n"),
    buildUser: (cb) => [
      "== الدعوى ==", claimBlock(claim), "",
      "== مقترح المدّعي ==", inputs.plaintiffProposal?.trim() || "لم يُقدَّم.",
      "== مقترح المدّعى عليه ==", inputs.defendantProposal?.trim() || "لم يُقدَّم.",
      "== معطياتٌ عامّة ==",
      `المبلغ: ${inputs.amount || "غير محدد"} | المدّة: ${inputs.duration || "غير محددة"} | الالتزامات: ${inputs.obligations || "غير محددة"} | التنازل: ${inputs.waiver || "غير محدد"}`,
      "", "== الأساس النظاميّ المتاح ==", cb, "", "يسّر الصلح وقارن المقترحين بصيغة JSON."
    ].join("\n")
  });
  if (!res) return null;
  const d = res.data;
  return {
    grounded: res.grounded,
    content: [
      "مسودة صلحٍ تدريبيّة مؤصَّلة",
      hasDual ? sec("تحليل الفجوة بين مقترحَي الطرفين", d.gapAnalysis) : null,
      sec("نقاط الالتقاء", d.commonGround),
      sec("بنود التسوية المقترحة", d.proposedTerms),
      sec("الالتزامات", d.obligations),
      sec("التوصية", d.recommendation),
      sec("تنبيه", d.caution),
      sec("الأساس النظاميّ", d.citations?.join("، ")),
      DISCLAIMER
    ].filter(Boolean).join("\n\n")
  };
}

// ─────────────────────────── ⑥ صياغة حكم الاعتراض ───────────────────────────
// (منقول من submitAppeal/submitNaqd/submitIltimas الكلاسيكيّة): مخرَجٌ نصّيٌّ كامل بالصياغة
// القضائيّة السعوديّة ومصطلحات كلّ مسارٍ حصريًّا — لا تحليلٌ رباعيّ. وقائع مُحالة، أسبابٌ
// مؤصَّلة تناقش كلّ سبب، ومنطوقٌ جازم، مع قاعدة اكتمالٍ وحارس اختلاق.
type ObjectionTerms = { court: string; appellant: string; respondent: string; note: string };

function objectionTerms(kind: string): ObjectionTerms {
  if (/نقض/.test(kind)) return { court: "المحكمة العليا", appellant: "طالب النقض", respondent: "المطعون ضدّه", note: "النقض يقتصر على مراقبة صحّة تطبيق النظام والمبادئ القضائيّة، ولا يُعيد محاكمة الوقائع." };
  if (/التماس/.test(kind)) return { court: "محكمة الاستئناف المؤيِّدة", appellant: "الملتمِس", respondent: "الملتمَس ضدّه", note: "الالتماس طريقٌ غير عاديّ لا يُقبل إلا بتحقّق سببٍ من أسبابه النظاميّة." };
  return { court: "دائرة الاستئناف", appellant: "المستأنِف", respondent: "المستأنَف ضدّه", note: "دائرة الاستئناف تُحيل لوقائع الحكم محلّ الاعتراض ولا تُعيد سردها." };
}

export async function analyzeObjection(input: {
  claim?: ClaimData;
  messages: Msg[];
  judgmentContent: string;
  kind: string; // استئناف | نقض | التماس إعادة نظر
  reasons?: string[];
}): Promise<{ content: string; grounded: boolean } | null> {
  const t = objectionTerms(input.kind);
  const reasons = (input.reasons ?? []).filter(Boolean);
  const agent = resolveSpecializedAgent(input.claim?.caseType);
  const groundText = `${input.claim?.subject ?? ""} ${input.kind} ${reasons.join(" ")} أسباب ومواعيد وشروط قبول ${input.kind}`;
  const g = await groundForJudge(groundText, 8, agent.scopeSystems);

  const sys = [
    `أنت قاضٍ في «${t.court}» بمنصّة حكيم للمحاكاة القضائيّة التدريبيّة، تصدر حكمًا في «${input.kind}» على حكمٍ سابق.`,
    "",
    JUDICIAL_DRAFTING_GUIDE,
    "",
    OBJECTION_FORMULAS,
    "",
    "== إلزامات هذا المسار ==",
    `- استعمل مصطلحات هذا الطريق حصرًا: «${t.appellant}» و«${t.respondent}» و«${t.court}» — ولا تخلطها بمصطلحات طريقٍ آخر.`,
    `- ${t.note}`,
    "- بنية المخرَج: (أولًا: قبول الاعتراض شكلًا — الميعاد والشروط) ← (ثانيًا: الوقائع محالةً للحكم محلّ الاعتراض بإيجاز) ← (ثالثًا: الأسباب: ناقش كلّ سببٍ مؤصَّلًا وبيّن وجه قبوله أو ردّه) ← (رابعًا: المنطوق الجازم: تأييد/تعديل/إلغاء/نقض/عدم قبول، وعند التأييد «محمولًا على أسبابه»).",
    "- لا تستشهد بمادّةٍ ليست في «الأساس النظاميّ المتاح»، ولا تخترع رقمًا. أكمل الحكم حتى المنطوق والخاتمة «والله الموفّق». اكتب نصًّا مباشرًا لا JSON."
  ].join("\n");

  const usr = [
    "== الدعوى ==",
    claimBlock(input.claim),
    "",
    "== الحكم محلّ الاعتراض (مقتطف) ==",
    (input.judgmentContent || "").slice(0, 1500) || "لم يُتَح نصّ الحكم.",
    "",
    reasons.length ? `== أسباب الاعتراض التي اختارها ${t.appellant} ==\n${reasons.join("\n")}` : `لم يحدّد ${t.appellant} أسبابًا مبنيَنة.`,
    "",
    "== الأساس النظاميّ المتاح (استشهد منه حصرًا) ==",
    g.citationBlock,
    "",
    `أصدر حكم «${input.kind}» الكامل بالبنية والمصطلحات المذكورة.`
  ].join("\n");

  const llm = await callCentralProvider({ systemPrompt: sys, userPrompt: usr, maxTokens: 3200 });
  if (!llm.ok || !llm.content.trim()) return null;
  let text = llm.content.trim();
  if (!/المنطوق|حكمت|قضت|الموفّق|الموفق/.test(text)) {
    const cont = await callCentralProvider({ systemPrompt: sys, userPrompt: `أكمِل المنطوق والخاتمة فقط لِما سبق:\n«${text.slice(-400)}»`, maxTokens: 900 });
    if (cont.ok && cont.content.trim()) text = `${text}\n${cont.content.trim()}`;
  }
  if (!verifyJudgeGrounding([text], g.allowedNumbers)) return null;

  return {
    grounded: g.allowedNumbers.size > 0,
    content: [`حكم ${input.kind} — بيئة محاكاة تدريبيّة`, "بسم الله الرحمن الرحيم", text.trim(), DISCLAIMER].join("\n\n")
  };
}

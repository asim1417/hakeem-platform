import type { SimulationDecision, SimulationMessage } from "@prisma/client";

export const claimMarker = "HAKEEM_CLAIM::";
export const scoreMarker = "HAKEEM_STRENGTH::";

export type ClaimData = {
  title?: string;
  caseType?: string;
  plaintiffName?: string;
  plaintiffCapacity?: string;
  defendantName?: string;
  defendantCapacity?: string;
  subject?: string;
  facts?: string;
  requests?: string;
  claimAmount?: string;
  legalGrounds?: string;
  defenses?: string;
  attendance?: string;
};

export function encodeClaim(data: ClaimData) {
  return `${claimMarker}${JSON.stringify(data)}`;
}

export function extractClaim(messages?: Array<Pick<SimulationMessage, "content">>): ClaimData | undefined {
  const source = [...(messages ?? [])].reverse().find((message) => message.content.startsWith(claimMarker));
  if (!source) return undefined;
  try {
    return JSON.parse(source.content.slice(claimMarker.length)) as ClaimData;
  } catch {
    return undefined;
  }
}

// إشارة بيّنة مشتقّة من مداخلات الأطراف والسند النظاميّ — بديلٌ عن عدّ مرفقاتٍ غير مرتبطة
// بالجلسة (لا يوجد ربط Attachment↔Simulation في المخطّط). يُغذّي فرع البيّنة في القاضي ومقياس القوّة.
const EVIDENCE_TERMS = /بيّنة|بينة|مستند|سند|شاهد|شهادة|إقرار|دليل|أدلة|عقد|فاتورة|إيصال|كشف|محضر|صك|خبرة/;
const PARTY_ROLES = ["المدعي", "وكيل المدعي", "المدعى عليه", "وكيل المدعى عليه"];

export function countEvidenceSignals(messages: Array<{ role: string; content: string }>, claim?: ClaimData): number {
  let n = messages.filter((m) => PARTY_ROLES.includes(m.role) && EVIDENCE_TERMS.test(m.content)).length;
  if (claim?.legalGrounds && claim.legalGrounds.trim()) n += 1;
  return n;
}

export function extractDecision(decisions: Array<Pick<SimulationDecision, "decisionType" | "content">>, decisionType: string) {
  return [...decisions].reverse().find((decision) => decision.decisionType === decisionType)?.content;
}

export function admissibilityCheck(claim?: ClaimData) {
  const missing = [];
  if (!claim?.plaintiffName) missing.push("اسم المدعي");
  if (!claim?.defendantName) missing.push("اسم المدعى عليه");
  if (!claim?.subject) missing.push("موضوع الدعوى");
  if (!claim?.facts) missing.push("الوقائع");
  if (!claim?.requests) missing.push("الطلبات");
  const complete = missing.length === 0;
  return {
    complete,
    missing,
    message: complete ? "اكتمل الحد الأدنى لفتح باب المرافعة." : "لا يمكن فتح باب المرافعة قبل استكمال البيانات الأساسية للدعوى."
  };
}

// ضبط الجلسة — يُفتَح بديباجةٍ قضائيّة، ويذكر صحيفة الدعوى والتاريخ والزمان، ويُصاغ بالصيغة
// القضائيّة السعوديّة في كلّ جلسة (منقولٌ من افتتاح الجلسة في القاعة الكلاسيكيّة).
export function buildHearingRecord(session: { id: string; title: string }, claim?: ClaimData) {
  const now = new Date().toLocaleString("ar-SA", { dateStyle: "full", timeStyle: "short" });
  const plaintiff = claim?.plaintiffName || "المدّعي";
  const defendant = claim?.defendantName || "المدّعى عليه";
  return [
    "بسم الله الرحمن الرحيم",
    "ضبط جلسة — بيئة محاكاة تدريبيّة | منصّة حكيم للمحاكاة القضائيّة",
    "",
    "أولًا: ديباجة الجلسة",
    `افتتحت الدائرة الافتراضيّة جلستها بتاريخ ${now}، برئاسة القاضي الافتراضيّ التدريبيّ، وبحضور طرفَي الدعوى، وبعد التحقّق من صفة الحاضرين شرعت الدائرة في نظر الدعوى وفق نظام المرافعات الشرعيّة.`,
    `رقم الجلسة: ${session.id}`,
    "",
    "ثانيًا: صحيفة الدعوى",
    "وبموجب صحيفة الدعوى المقيّدة لدى المنصّة، تتلخّص الدعوى فيما يلي:",
    `• موضوع الدعوى: ${claim?.subject || session.title}`,
    `• نوع الدعوى: ${claim?.caseType || "غير محدد"}`,
    `• المدّعي: ${plaintiff}${claim?.plaintiffCapacity ? " — بصفته " + claim.plaintiffCapacity : ""}`,
    `• المدّعى عليه: ${defendant}${claim?.defendantCapacity ? " — بصفته " + claim.defendantCapacity : ""}`,
    claim?.claimAmount ? `• قيمة المطالبة: ${claim.claimAmount}` : null,
    `• الوقائع: ${claim?.facts || "لم تُسجّل وقائع تفصيليّة."}`,
    `• الطلبات: ${claim?.requests || "لم تُحدَّد الطلبات."}`,
    claim?.legalGrounds ? `• الأساس النظاميّ الذي ذكره المدّعي: ${claim.legalGrounds}` : null,
    `• إثبات الحضور والصفة: ${claim?.attendance || "لم تُسجّل بيانات حضورٍ تفصيليّة."}`,
    "",
    "ثالثًا: إجراءات الجلسة",
    "وبعد سماع الدعوى وحصر محلّ النزاع، مكّنت الدائرة المدّعيَ من عرض دعواه ووقائعها وطلباته، ثمّ المدّعى عليه من جوابه ودفوعه، وأفهمت الطرفين بأنّ القرارات الإجرائيّة تُتّخذ في محالّها قبل الحكم.",
    "",
    "رابعًا: قرار الجلسة",
    "قرّرت الدائرة فتح باب المرافعة تدريبيًّا، وتمكين الطرفين من تبادل العرض والجواب والبيّنات، على أن يُحرَّر محلّ النزاع ويُفصَل فيه وفق الأصول.",
    "",
    "خامسًا: التنبيه",
    "هذا المستند صادرٌ في بيئة محاكاةٍ تدريبيّة بمنصّة حكيم، ولا يُعدّ حكمًا قضائيًّا ولا رأيًا قانونيًّا نهائيًّا، ولا يُغني عن مراجعة المختصّ.",
    "الصفة: قاضٍ افتراضيّ تدريبيّ — حكيم"
  ]
    .filter(Boolean)
    .join("\n");
}

// الافتتاح القضائيّ المنمَّق (منقولٌ من launchJudgeOpening الكلاسيكيّ): خطابُ قاضٍ يفتتح
// الجلسة، يثبت حضور الأطراف وصفاتهم، يتحقّق من انعقاد الخصومة، ثمّ يمكّن المدّعي — يُعرَض
// كأوّل رسالةٍ في المحضر لتجربةٍ مهيبة وواقعيّة.
export function buildJudgeOpening(claim?: ClaimData, title?: string) {
  const plaintiff = claim?.plaintiffName || "المدّعي";
  const defendant = claim?.defendantName || "المدّعى عليه";
  const pcap = claim?.plaintiffCapacity ? ` بصفته ${claim.plaintiffCapacity}` : "";
  const dcap = claim?.defendantCapacity ? ` بصفته ${claim.defendantCapacity}` : "";
  const attend = claim?.attendance && claim.attendance.trim() ? ` ${claim.attendance.trim()}.` : "";
  return [
    "بسم الله الرحمن الرحيم",
    "افتتحت الدائرة الافتراضيّة جلستها بمنصّة حكيم للمحاكاة القضائيّة.",
    `حضر المدّعي ${plaintiff}${pcap}، والمدّعى عليه ${defendant}${dcap}.${attend}`,
    "وبعد التحقّق من صفة الحاضرين وسلامة انعقاد الخصومة، شرعت الدائرة في نظر الدعوى.",
    `وموضوع الدعوى: ${claim?.subject || title || "غير محدد"}.`,
    "وتُفهِم الدائرة الطرفين بالتقيّد بالنظام وحسن الأدب في المرافعة، وأنّ القرارات الإجرائيّة تُتّخذ في محالّها قبل الحكم.",
    "والدور الآن للمدّعي لعرض دعواه ووقائعها وطلباته."
  ].join("\n");
}

export function strengthScore(claim?: ClaimData, attachmentsCount = 0) {
  const checks = [
    [Boolean(claim?.facts && claim.facts.length > 30), "وضوح الوقائع"],
    [Boolean(claim?.requests && claim.requests.length > 10), "تحديد الطلبات"],
    [attachmentsCount > 0, "وجود بينة أو مرفق"],
    [Boolean(claim?.legalGrounds), "وجود سند أو أسانيد"],
    [Boolean(claim?.defenses), "اتساق الدفوع"],
    [Boolean(claim?.plaintiffName && claim?.defendantName && claim?.subject), "اكتمال بيانات الأطراف"]
  ] as const;
  const score = Math.round((checks.filter(([passed]) => passed).length / checks.length) * 100);
  return {
    score,
    notes: checks.map(([passed, label]) => `${passed ? "مكتمل" : "ناقص"}: ${label}`)
  };
}

export function buildSettlementDraft(input: { amount?: string; obligations?: string; duration?: string; waiver?: string }) {
  return [
    "مسودة صلح تدريبية غير ملزمة",
    `مبلغ التسوية: ${input.amount || "غير محدد"}`,
    `الالتزامات: ${input.obligations || "غير محددة"}`,
    `مدة التنفيذ: ${input.duration || "غير محددة"}`,
    `شرط التنازل أو إنهاء النزاع: ${input.waiver || "غير محدد"}`,
    "هذه مسودة تدريبية لا تعد اتفاقًا ملزمًا إلا بعد مراجعتها واعتمادها من الأطراف والمختصين."
  ].join("\n");
}

export function buildAppealDraft(kind: string, reasons: string[]) {
  return [
    `${kind} تدريبي`,
    `الأسباب المختارة: ${reasons.length ? reasons.join("، ") : "لم تحدد أسباب"}`,
    "TODO: توليد مذكرة اعتراض تفصيلية لاحقًا بعد تفعيل نماذج اعتراض متخصصة.",
    "هذا الطلب تدريبي وغير ملزم ولا يعد إجراء قضائيًا فعليًا."
  ].join("\n");
}

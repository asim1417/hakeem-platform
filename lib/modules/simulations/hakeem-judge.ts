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

export function extractClaim(messages: Array<Pick<SimulationMessage, "content">>): ClaimData | undefined {
  const source = [...messages].reverse().find((message) => message.content.startsWith(claimMarker));
  if (!source) return undefined;
  try {
    return JSON.parse(source.content.slice(claimMarker.length)) as ClaimData;
  } catch {
    return undefined;
  }
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

export function buildHearingRecord(session: { id: string; title: string }, claim?: ClaimData) {
  const now = new Date().toLocaleString("ar-SA");
  return [
    `التاريخ والوقت: ${now}`,
    "المنصة: حكيم",
    "الصفة: قاضٍ افتراضي تدريبي",
    `رقم الجلسة: ${session.id}`,
    `موضوع الدعوى: ${claim?.subject || session.title}`,
    `المدعي: ${claim?.plaintiffName || "غير محدد"} - صفته: ${claim?.plaintiffCapacity || "غير محددة"}`,
    `المدعى عليه: ${claim?.defendantName || "غير محدد"} - صفته: ${claim?.defendantCapacity || "غير محددة"}`,
    `إثبات الحضور والوكالة: ${claim?.attendance || "لم تسجل بيانات حضور تفصيلية"}`,
    `ملخص الدعوى: ${claim?.facts || "لم تسجل وقائع تفصيلية"}`,
    "قرار الجلسة: فتح باب المرافعة تدريبياً وتمكين الأطراف من عرض الدعوى والجواب.",
    "تنبيه: هذا الضبط تدريبي وغير ملزم ولا يعد محضرًا قضائيًا فعليًا."
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
    "هذا الطلب تدريبي وغير ملزم ولا يعد إجراءً قضائيًا فعليًا."
  ].join("\n");
}

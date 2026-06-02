import type { SimulationStage } from "@prisma/client";

export const judicialSimulationStages: Array<{ key: SimulationStage; label: string }> = [
  { key: "CLAIM_FILING", label: "تقييد الدعوى" },
  { key: "INITIAL_ADMISSIBILITY", label: "فحص القبول المبدئي" },
  { key: "PLEADING", label: "فتح باب المرافعة" },
  { key: "PLAINTIFF_STATEMENT", label: "مداخلة المدعي" },
  { key: "DEFENDANT_RESPONSE", label: "جواب المدعى عليه" },
  { key: "PROCEDURAL_DECISION", label: "القرارات الإجرائية" },
  { key: "CLOSE_PLEADING", label: "قفل باب المرافعة" },
  { key: "TRAINING_JUDGMENT", label: "الحكم التدريبي" }
];

export const hakeemJudgeStages = [
  { key: "CLAIM_FILING", label: "تقييد الدعوى" },
  { key: "INITIAL_ADMISSIBILITY", label: "فحص القبول المبدئي" },
  { key: "CLAIM_SHEET", label: "توليد صحيفة الدعوى" },
  { key: "HEARING_OPENING", label: "فتح الجلسة" },
  { key: "HEARING_RECORD", label: "ضبط الجلسة" },
  { key: "ATTENDANCE_VERIFICATION", label: "إثبات الحضور والصفة" },
  { key: "PLAINTIFF_STATEMENT", label: "مداخلة المدعي" },
  { key: "DEFENDANT_RESPONSE", label: "جواب المدعى عليه" },
  { key: "EVIDENCE_MANAGEMENT", label: "إدارة الدفوع والبينات" },
  { key: "PROCEDURAL_DECISION", label: "القرارات الإجرائية" },
  { key: "SETTLEMENT", label: "عرض الصلح" },
  { key: "CLOSE_PLEADING", label: "قفل باب المرافعة" },
  { key: "TRAINING_JUDGMENT", label: "إصدار الحكم التدريبي" },
  { key: "POST_JUDGMENT", label: "ما بعد الحكم" }
];

export function stageLabel(stage: SimulationStage | string) {
  return hakeemJudgeStages.find((item) => item.key === stage)?.label ?? judicialSimulationStages.find((item) => item.key === stage)?.label ?? String(stage);
}

export function nextStageForRole(role: string): SimulationStage {
  if (role === "المدعي") return "PLAINTIFF_STATEMENT";
  if (role === "وكيل المدعي") return "PLAINTIFF_STATEMENT";
  if (role === "المدعى عليه") return "DEFENDANT_RESPONSE";
  if (role === "وكيل المدعى عليه") return "DEFENDANT_RESPONSE";
  if (role === "القاضي الافتراضي") return "PLEADING";
  return "HEARING_RECORD";
}

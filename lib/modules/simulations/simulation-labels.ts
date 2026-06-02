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

export function stageLabel(stage: SimulationStage | string) {
  return judicialSimulationStages.find((item) => item.key === stage)?.label ?? String(stage);
}

export function nextStageForRole(role: string): SimulationStage {
  if (role === "المدعي") return "PLAINTIFF_STATEMENT";
  if (role === "المدعى عليه") return "DEFENDANT_RESPONSE";
  if (role === "القاضي الافتراضي") return "PLEADING";
  return "HEARING_RECORD";
}

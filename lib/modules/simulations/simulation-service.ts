import { SimulationStage } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { workflowGuardMode } from "@/lib/modules/config/workflow-guard";
import { SIMULATION_WORKFLOW, validateAdvance } from "@/lib/modules/workflow/state-machine";
import { auditEvent } from "@/lib/modules/audit/audit";

export const simulationStages: SimulationStage[] = [
  "CLAIM_FILING",
  "INITIAL_ADMISSIBILITY",
  "HEARING_RECORD",
  "PLAINTIFF_STATEMENT",
  "DEFENDANT_RESPONSE",
  "PROCEDURAL_DECISION",
  "PLEADING",
  "SETTLEMENT",
  "CLOSE_PLEADING",
  "TRAINING_JUDGMENT",
  "OBJECTION"
];

export async function advanceSimulation(simulationId: string, stage: SimulationStage) {
  const mode = workflowGuardMode();

  // off (الافتراضيّ): سلوكٌ مطابقٌ تمامًا — لا قراءة إضافيّة، لا تحقّق.
  if (mode === "off") {
    return prisma.simulation.update({ where: { id: simulationId }, data: { stage } });
  }

  // warn/enforce: نتحقّق من شرعيّة الانتقال دون تغيير الأحكام أو الاستدلال.
  const current = await prisma.simulation.findUnique({
    where: { id: simulationId },
    select: { stage: true },
  });
  if (current) {
    const decision = validateAdvance(SIMULATION_WORKFLOW, current.stage as never, stage as never);
    if (!decision.allowed) {
      if (mode === "enforce") {
        // حجبٌ صريح — فقط لمن فعّل enforce بعد التحقّق من الخريطة.
        throw new Error(`انتقال غير مسموح (§14): ${current.stage} → ${stage}. ${decision.reason}`);
      }
      // warn: لا حجب — تسجيلٌ للمراقبة فقط.
      await auditEvent({
        subject: "SIMULATION",
        action: "WORKFLOW_INVALID_TRANSITION",
        entityId: simulationId,
        metadata: { from: current.stage, to: stage, reason: decision.reason, mode },
      }).catch(() => undefined);
    }
  }

  return prisma.simulation.update({ where: { id: simulationId }, data: { stage } });
}

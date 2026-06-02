import { SimulationStage } from "@prisma/client";
import { prisma } from "@/lib/prisma";

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
  return prisma.simulation.update({
    where: { id: simulationId },
    data: { stage }
  });
}

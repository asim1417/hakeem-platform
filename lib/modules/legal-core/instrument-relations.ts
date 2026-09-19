import { prisma } from "@/lib/prisma";
import { extractCouncilDecisionRefs, normalizeInstrumentNumber } from "./system-readiness";

export type InstrumentRelationResult = {
  systemId: string;
  created: number;
  existing: number;
  unresolved: Array<{ sourceUnitId: string; decisionNumber: string }>;
};

export async function linkCouncilDecisionReferences(systemId: string): Promise<InstrumentRelationResult> {
  const documents = await prisma.legalDocument.findMany({
    where: { systemId, docType: { in: ["ROYAL_DECREE", "COUNCIL_DECISION"] } },
    select: {
      id: true,
      docType: true,
      number: true,
      sourceGuid: true,
      units: {
        orderBy: { ordinal: "asc" },
        select: {
          id: true,
          unitType: true,
          ordinal: true,
          textRaw: true,
          path: true,
          sourceGuid: true,
        },
      },
    },
  });

  const cabinetByNumber = new Map(
    documents
      .filter((d) => d.docType === "COUNCIL_DECISION" && d.number)
      .map((d) => [normalizeInstrumentNumber(d.number), d] as const),
  );

  let created = 0;
  let existing = 0;
  const unresolved: InstrumentRelationResult["unresolved"] = [];

  for (const decree of documents.filter((d) => d.docType === "ROYAL_DECREE")) {
    for (const unit of decree.units.filter((u) => u.unitType === "RECITAL")) {
      const refs = extractCouncilDecisionRefs(unit.textRaw);
      for (const ref of refs) {
        const cabinet = cabinetByNumber.get(ref.number);
        if (!cabinet) {
          unresolved.push({ sourceUnitId: unit.id, decisionNumber: ref.number });
          continue;
        }
        const target =
          cabinet.units.find((u) => u.unitType === "INSTRUMENT_OPENING") ??
          cabinet.units[0] ??
          null;
        if (!target) {
          unresolved.push({ sourceUnitId: unit.id, decisionNumber: ref.number });
          continue;
        }

        const found = await prisma.documentRelation.findFirst({
          where: {
            relationType: "CITES",
            sourceUnitId: unit.id,
            targetUnitId: target.id,
          },
          select: { id: true },
        });
        if (found) {
          existing++;
          continue;
        }

        await prisma.documentRelation.create({
          data: {
            relationType: "CITES",
            sourceUnitId: unit.id,
            targetUnitId: target.id,
            targetRef: "قرار مجلس الوزراء رقم " + ref.number + (ref.hijriDate ? " وتاريخ " + ref.hijriDate : ""),
            targetPath: target.path,
            evidenceQuote: unit.textRaw.trim(),
            sourceGuid: unit.sourceGuid ?? decree.sourceGuid ?? null,
            reviewStatus: "verified",
          },
        });
        created++;
      }
    }
  }

  return { systemId, created, existing, unresolved };
}

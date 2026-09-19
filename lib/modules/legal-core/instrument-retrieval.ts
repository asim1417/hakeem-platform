import { prisma } from "@/lib/prisma";

export type InstrumentProvision = {
  unitId: string;
  systemId: string;
  systemName: string;
  documentId: string;
  documentType: string;
  documentNumber: string | null;
  hijriDate: string | null;
  unitType: string;
  unitNumber: string | null;
  label: string | null;
  text: string;
  sourceUrl: string | null;
  sourceCode: string | null;
  verificationStatus: string;
  citationLabel: string;
};

const NORMATIVE_UNIT_TYPES = [
  "INSTRUMENT_OPENING",
  "RECITAL",
  "INSTRUMENT_CLAUSE",
  "INSTRUMENT_CLOSING",
  "SYSTEM_PREAMBLE",
] as const;

export async function searchInstrumentProvisions(opts: {
  query: string;
  limit?: number;
  systemIds?: string[];
  readyOnly?: boolean;
}): Promise<InstrumentProvision[]> {
  const query = opts.query.trim();
  if (!query) return [];
  const limit = Math.min(Math.max(opts.limit ?? 8, 1), 50);
  const readyOnly = opts.readyOnly !== false;

  const rows = await prisma.documentUnit.findMany({
    where: {
      unitType: { in: [...NORMATIVE_UNIT_TYPES] },
      ...(opts.systemIds?.length ? { systemId: { in: opts.systemIds } } : {}),
      ...(readyOnly ? { system: { is: { launchStatus: "READY" } } } : {}),
      document: {
        is: { verificationStatus: { in: ["SOURCE_MATCHED", "CROSS_SOURCE_MATCHED"] } },
      },
      OR: [
        { textRaw: { contains: query, mode: "insensitive" } },
        { textNormalized: { contains: query, mode: "insensitive" } },
        { labelAr: { contains: query, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      systemId: true,
      unitType: true,
      number: true,
      labelAr: true,
      textRaw: true,
      system: { select: { name: true } },
      document: {
        select: {
          id: true,
          docType: true,
          number: true,
          hijriDate: true,
          sourceUrl: true,
          sourceCode: true,
          verificationStatus: true,
        },
      },
    },
    orderBy: [{ documentId: "asc" }, { ordinal: "asc" }],
    take: limit,
  });

  return rows.map((row) => {
    const d = row.document;
    const docLabel =
      d.docType === "ROYAL_DECREE" ? "المرسوم الملكي" :
      d.docType === "COUNCIL_DECISION" ? "قرار مجلس الوزراء" :
      d.docType === "AGENCY_DECISION" ? "قرار الجهة" :
      d.docType === "SYSTEM_TEXT" ? "نص النظام" : "اللائحة";
    const unitLabel = row.labelAr || (row.number ? "البند " + row.number : "");
    return {
      unitId: row.id,
      systemId: row.systemId,
      systemName: row.system.name,
      documentId: d.id,
      documentType: d.docType,
      documentNumber: d.number,
      hijriDate: d.hijriDate,
      unitType: row.unitType,
      unitNumber: row.number,
      label: row.labelAr,
      text: row.textRaw,
      sourceUrl: d.sourceUrl,
      sourceCode: d.sourceCode,
      verificationStatus: d.verificationStatus,
      citationLabel: [row.system.name, docLabel, d.number ? "رقم " + d.number : null, unitLabel || null].filter(Boolean).join(" — "),
    };
  });
}

export async function getSystemInstrumentBundle(systemName: string) {
  const system = await prisma.legalSystem.findFirst({
    where: { name: { contains: systemName.trim(), mode: "insensitive" } },
    select: {
      id: true,
      name: true,
      launchStatus: true,
      launchValidatedAt: true,
      launchIssues: true,
      documents: {
        orderBy: [{ docType: "asc" }, { publishedAt: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          docType: true,
          number: true,
          hijriDate: true,
          gregorianDate: true,
          publishedAt: true,
          sourceUrl: true,
          sourceCode: true,
          sourceDocumentId: true,
          contentSha256: true,
          verificationStatus: true,
          units: {
            where: { unitType: { in: [...NORMATIVE_UNIT_TYPES] } },
            orderBy: { ordinal: "asc" },
            select: {
              id: true,
              unitType: true,
              number: true,
              labelAr: true,
              textRaw: true,
              status: true,
              validFrom: true,
              validTo: true,
            },
          },
        },
      },
    },
  });
  return system;
}

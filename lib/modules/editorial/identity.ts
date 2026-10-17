import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { compareWorkIdentity } from "./checks";
import { hash, type Tx } from "./repository";
import { normalizeArabicText } from "../legal-core/arabic-morphology";

export const identitySchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("work"),
    name: z.string().min(1),
    instrument: z.string().min(1),
    date: z.string().min(1),
  }),
  z.object({
    type: z.literal("unit"),
    workId: z.string().min(1),
    articleNumber: z.number().int(),
    text: z.string().min(1),
  }),
  z.object({
    type: z.literal("ruling"),
    sourceId: z.number().int().optional(),
    caseNo: z.string().optional(),
    date: z.string().optional(),
    court: z.string().optional(),
    text: z.string().min(1),
  }),
]);
export async function resolveIdentity(
  input: z.infer<typeof identitySchema>,
  db: Tx = prisma,
) {
  if (input.type === "work") {
    const rows = await db.legalSystem.findMany({
      select: { id: true, name: true },
    });
    const latest = await db.editorialWorkVersion.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    const overlay = new Map<string, Record<string, unknown>>();
    for (const row of latest)
      if (
        !overlay.has(row.workId) &&
        row.data &&
        typeof row.data === "object" &&
        !Array.isArray(row.data)
      )
        overlay.set(row.workId, row.data);
    const tables = await db.$queryRaw<
      Array<{ present: boolean }>
    >`SELECT to_regclass('uqn_fix.issuance_instrument') IS NOT NULL AS present`;
    const candidates: Array<{
      id: string;
      name: string;
      match: "exact" | "ambiguous";
    }> = [];
    for (const row of rows) {
      const meta = overlay.get(row.id);
      const aliases = Array.isArray(meta?.aliases)
        ? meta.aliases.filter((v): v is string => typeof v === "string")
        : [];
      const name =
        typeof meta?.officialName === "string" ? meta.officialName : row.name;
      if (
        compareWorkIdentity(input, {
          name,
          aliases,
          instrument: "",
          date: "",
        }) === "new"
      )
        continue;
      const issuance = tables[0]?.present
        ? await db.$queryRaw<
            Array<{ number: string; date: string }>
          >`SELECT instrument_no AS number,instrument_date_hijri AS date FROM uqn_fix.issuance_instrument WHERE law_title=${row.name} ORDER BY id DESC LIMIT 1`
        : [];
      const match = compareWorkIdentity(input, {
        name,
        aliases,
        instrument: String(meta?.instrumentNumber ?? issuance[0]?.number ?? ""),
        date: String(
          [meta?.issuedOn, meta?.issuedHijri, issuance[0]?.date].find(
            (v) => v === input.date,
          ) ??
            meta?.issuedOn ??
            issuance[0]?.date ??
            "",
        ),
      });
      if (match !== "new") candidates.push({ ...row, match });
    }
    const exact = candidates.filter((c) => c.match === "exact");
    return {
      status:
        exact.length === 1 ? "exact" : candidates.length ? "ambiguous" : "new",
      candidates,
    };
  }
  if (input.type === "unit") {
    const rows = await db.legalArticle.findMany({
      where: {
        legalSystemId: input.workId,
        articleNumber: input.articleNumber,
      },
      select: { id: true, content: true },
    });
    const exact = rows.filter(
      (r) =>
        hash(normalizeArabicText(r.content)) ===
        hash(normalizeArabicText(input.text)),
    );
    return {
      status: exact.length === 1 ? "exact" : rows.length ? "ambiguous" : "new",
      candidates: rows.map((r) => ({
        id: r.id,
        match: exact.includes(r) ? "exact" : "ambiguous",
      })),
    };
  }
  const rows = await db.judicialCase.findMany({
    where:
      input.sourceId !== undefined
        ? { sourceId: input.sourceId }
        : input.caseNo && input.date && input.court
          ? {
              caseNo: input.caseNo,
              decisionDateText: input.date,
              court: input.court,
            }
          : { id: "__no_identity__" },
    select: { id: true, judgmentText: true },
  });
  const exact = rows.filter(
    (r) =>
      hash(normalizeArabicText(r.judgmentText)) ===
      hash(normalizeArabicText(input.text)),
  );
  return {
    status:
      exact.length === 1
        ? "exact"
        : rows.length ||
            (input.sourceId === undefined &&
              !(input.caseNo && input.date && input.court))
          ? "ambiguous"
          : "new",
    candidates: rows.map((r) => ({
      id: r.id,
      match: exact.includes(r) ? "exact" : "ambiguous",
    })),
  };
}

import { prisma } from "@/lib/prisma";
import { missingTable } from "./repository";
import { metadataSchema } from "./contracts";
import { z } from "zod";
const schema = metadataSchema
  .extend({
    preamble: z.string().nullable().optional(),
    preambleRoyalDecree: z.string().nullable().optional(),
    preambleEffectiveFrom: z.string().nullable().optional(),
    status: z.string().nullable().optional(),
  })
  .partial()
  .strip();
export async function publishedWorkOverlay(workId: string) {
  try {
    const row = await prisma.editorialWorkVersion.findFirst({
      where: { workId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    if (
      !row ||
      !row.data ||
      typeof row.data !== "object" ||
      Array.isArray(row.data)
    )
      return null;
    const keys = Array.isArray(row.data._overlayKeys)
      ? row.data._overlayKeys
      : null;
    const data = Object.fromEntries(
      Object.entries(row.data).filter(
        ([key, value]) =>
          (!keys || keys.includes(key)) &&
          (value !== null ||
            [
              "preamble",
              "preambleRoyalDecree",
              "preambleEffectiveFrom",
              "status",
            ].includes(key)),
      ),
    );
    return schema.parse(data);
  } catch (e) {
    if (missingTable(e)) return null;
    throw e;
  }
}

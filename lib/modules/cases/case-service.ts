import { prisma } from "@/lib/prisma";

export async function listCases(ownerId?: string) {
  return prisma.caseFile.findMany({
    where: ownerId ? { ownerId } : undefined,
    include: { attachments: true },
    orderBy: { updatedAt: "desc" }
  });
}

import { prisma } from "@/lib/prisma";

export async function listConsultations(userId?: string) {
  return prisma.consultation.findMany({
    where: userId ? { userId } : undefined,
    include: { citations: true },
    orderBy: { updatedAt: "desc" }
  });
}

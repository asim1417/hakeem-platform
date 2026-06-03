import { prisma } from "@/lib/prisma";

export async function awardTrainingPoints(userId: string, points: number, badge?: string) {
  const current = await prisma.trainingProgress.findFirst({ where: { userId } });
  const badges = badge ? Array.from(new Set([...(current?.badges ?? []), badge])) : current?.badges ?? [];

  return prisma.trainingProgress.upsert({
    where: { id: current?.id ?? "new-progress" },
    update: { points: { increment: points }, badges },
    create: { userId, points, badges }
  });
}

import "server-only";

// تصدير كامل لبيانات المستخدم — المخطط السيادي §33 و§4.1 (سيادة البيانات، لا حبس).
// دفاعيّ: كل استعلام مغلّف (catch → []) فلا يتعطّل التصدير إن غاب جدول قبل الهجرة.

import { prisma } from "@/lib/prisma";
import { buildUri } from "@/lib/modules/knowledge/uri";

export async function buildAccountExport(userId: string, nowIso: string) {
  const [cases, consultations, simulations, annotations, folders, training, reviewSessions, judicialCases] =
    await Promise.all([
      prisma.caseFile.findMany({ where: { ownerId: userId } }).catch(() => []),
      prisma.consultation
        .findMany({ where: { userId }, include: { citations: true } })
        .catch(() => []),
      prisma.simulation.findMany({ where: { userId } }).catch(() => []),
      prisma.annotation.findMany({ where: { userId } }).catch(() => []),
      prisma.folder.findMany({ where: { userId } }).catch(() => []),
      prisma.trainingProgress.findMany({ where: { userId } }).catch(() => []),
      prisma.reviewSession
        .findMany({ where: { ownerId: userId }, include: { findings: true, suggestions: true, report: true } })
        .catch(() => []),
      prisma.judicialWorkCase.findMany({ where: { ownerId: userId } }).catch(() => []),
    ]);

  return {
    schema: "hakeem.account-export/1",
    exportedAt: nowIso,
    subject: buildUri("case", userId).replace("case", "user"),
    userId,
    counts: {
      cases: cases.length,
      consultations: consultations.length,
      simulations: simulations.length,
      annotations: annotations.length,
      folders: folders.length,
      training: training.length,
      reviewSessions: reviewSessions.length,
      judicialCases: judicialCases.length,
    },
    data: {
      cases,
      consultations,
      simulations,
      annotations,
      folders,
      training,
      reviewSessions,
      judicialCases,
    },
  };
}

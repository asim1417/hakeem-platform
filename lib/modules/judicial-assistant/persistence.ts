// ─────────────────────────────────────────────────────────────────────────────
// حفظ مخرجات التحليل (المرحلة 1ب). الجدول يُنشأ بسكربت idempotent (لا migrate deploy
// في البناء)، فالوصول هنا **دفاعيّ**: إن لم يوجد الجدول بعد يسقط سقوطًا آمنًا دون كسر الصفحة.
// ─────────────────────────────────────────────────────────────────────────────
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureJudicialSchema } from "./schema-ensure";

export interface SavedAnalysis {
  id: string;
  caseRef: string;
  caseNumber: string;
  serviceId: string;
  blocked: boolean;
  createdAt: string;
}

/** يحفظ مخرَج عملٍ. fail-open: أي خطأ (جدول غير موجود/غيره) لا يكسر الاستجابة. */
export async function saveAnalysis(input: {
  caseRef: string;
  caseNumber: string;
  serviceId: string;
  blocked: boolean;
  payload: unknown;
  actorId?: string;
}): Promise<string | null> {
  try {
    await ensureJudicialSchema();
    const row = await prisma.judicialAnalysis.create({
      data: {
        caseRef: input.caseRef,
        caseNumber: input.caseNumber,
        serviceId: input.serviceId,
        blocked: input.blocked,
        payload: input.payload as Prisma.InputJsonValue,
        actorId: input.actorId,
      },
      select: { id: true },
    });
    return row.id;
  } catch {
    return null;
  }
}

/** يقرأ سجلّ تحليلات قضية (الأحدث أولًا). fail-open: [] عند غياب الجدول. */
export async function listAnalyses(caseRef: string, take = 30): Promise<SavedAnalysis[]> {
  try {
    const rows = await prisma.judicialAnalysis.findMany({
      where: { caseRef },
      orderBy: { createdAt: "desc" },
      take,
      select: { id: true, caseRef: true, caseNumber: true, serviceId: true, blocked: true, createdAt: true },
    });
    return rows.map((r) => ({
      id: r.id,
      caseRef: r.caseRef,
      caseNumber: r.caseNumber,
      serviceId: r.serviceId,
      blocked: r.blocked,
      createdAt: r.createdAt.toISOString(),
    }));
  } catch {
    return [];
  }
}

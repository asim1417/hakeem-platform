import { prisma } from "@/lib/prisma";
import type { Annotation } from "@prisma/client";

export interface CreateAnnotationInput {
  caseId?: string | null;
  documentType: string; // article | ruling | principle
  documentId: string;
  highlightedText?: string | null;
  note?: string | null;
  color?: string;
}

export async function createAnnotation(userId: string, input: CreateAnnotationInput): Promise<Annotation> {
  return prisma.annotation.create({
    data: {
      userId,
      caseId: input.caseId ?? null,
      documentType: input.documentType,
      documentId: input.documentId,
      highlightedText: input.highlightedText ?? null,
      note: input.note ?? null,
      color: input.color ?? "#FEF08A",
    },
  });
}

export async function listAnnotations(
  userId: string,
  opts?: { documentType?: string; documentId?: string; limit?: number }
): Promise<Annotation[]> {
  return prisma.annotation.findMany({
    where: {
      userId,
      ...(opts?.documentType ? { documentType: opts.documentType } : {}),
      ...(opts?.documentId ? { documentId: opts.documentId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(opts?.limit ?? 100, 300),
  });
}

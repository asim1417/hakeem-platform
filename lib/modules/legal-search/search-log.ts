import "server-only";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/modules/auth/session";

/**
 * يسجّل استعلام بحث لقياس الاستخدام وتحسين الصلة لاحقًا.
 * غير حاجب وآمن: أي خطأ (أو غياب الجدول قبل db push) يُبتلع دون كسر البحث.
 */
export async function recordSearch(input: {
  query: string;
  filters?: Record<string, unknown> | null;
  resultsCount: number;
}): Promise<void> {
  try {
    const user = await getCurrentUser().catch(() => null);
    await prisma.searchLog.create({
      data: {
        userId: user?.id ?? null,
        query: input.query.slice(0, 500),
        filters: (input.filters ?? undefined) as object | undefined,
        resultsCount: input.resultsCount,
      },
    });
  } catch {
    /* لا شيء — التسجيل اختياري ولا يجوز أن يكسر البحث */
  }
}

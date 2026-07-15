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

/**
 * آخر عبارات بحث المستخدم الحالي — مميّزة (بلا تكرار) ومرتّبة بالأحدث.
 * تُستخدم لعرض «عمليات بحثك الأخيرة» عند تركيز صندوق البحث وهو فارغ.
 * خاصّة بالمستخدم فقط (userId): لا تُسرَّب سجلات غيره. آمنة: أي خطأ يُعيد [].
 */
export async function getRecentSearches(limit = 6): Promise<string[]> {
  try {
    const user = await getCurrentUser().catch(() => null);
    if (!user?.id) return [];
    const take = Math.max(1, Math.min(limit, 12));
    // نجلب أكثر من المطلوب ثم نزيل التكرار (بعد تشذيب المسافات) للحفاظ على الأحدث.
    const rows = await prisma.searchLog.findMany({
      where: { userId: user.id, query: { not: "" } },
      select: { query: true },
      orderBy: { createdAt: "desc" },
      take: take * 5,
    });
    const seen = new Set<string>();
    const out: string[] = [];
    for (const r of rows) {
      const key = r.query.trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(key);
      if (out.length >= take) break;
    }
    return out;
  } catch {
    return [];
  }
}

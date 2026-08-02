// أرشيف نسخ أداة الوثائق: يحفظ لقطةً كاملة عند كل حفظ (تاريخٌ لا يُستبدَل)، ويُبقي
// آخر KEEP لكل مساحة عمل. fail-open تمامًا: أيّ خطأ (منها غياب الجدول قبل prisma db
// push) يُبتلع فلا يتأثّر حفظ المستخدم. مُفعَّل افتراضيًا، إيقاف طارئ:
// HAKEEM_DOC_TOOL_VERSIONS_V1=0.

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { retainRecentCount } from "@/lib/modules/doc-tool/snapshot-retention";

/** آخر عددٍ من النسخ يُحتفَظ به لكل مساحة عمل (كبح النموّ). */
export const SNAPSHOT_KEEP = 10;

function enabled(): boolean {
  const v = (process.env.HAKEEM_DOC_TOOL_VERSIONS_V1 ?? "").trim().toLowerCase();
  return !(v === "0" || v === "false" || v === "off" || v === "no");
}

/** يؤرشف لقطة الحفظ ثم يقلّم ما تجاوز الحدّ. لا يعطّل الحفظ أبدًا (fail-open). */
export async function archiveSnapshot(input: {
  workspaceId: string;
  actorId?: string;
  docs: unknown;
  docCount: number;
}): Promise<void> {
  if (!enabled()) return;
  try {
    await prisma.docToolSnapshot.create({
      data: {
        workspaceId: input.workspaceId,
        actorId: input.actorId,
        docs: input.docs as Prisma.InputJsonValue,
        docCount: input.docCount
      }
    });
    // تقليم: أبقِ آخر SNAPSHOT_KEEP فقط (الأحدث أولًا، واحذف ما بعدها).
    const rows = await prisma.docToolSnapshot.findMany({
      where: { workspaceId: input.workspaceId },
      orderBy: { createdAt: "desc" },
      select: { id: true }
    });
    const stale = retainRecentCount(
      rows.map((r) => r.id),
      SNAPSHOT_KEEP
    );
    if (stale.length) {
      await prisma.docToolSnapshot.deleteMany({ where: { id: { in: stale } } });
    }
  } catch {
    /* fail-open: الأرشفة لا تعطّل الحفظ (منها: الجدول غير مُنشأ بعد → prisma db push) */
  }
}

/** بيانات نسخةٍ وصفيّة (بلا محتوى) — للعرض في واجهة/لوحة لاحقًا. */
export interface SnapshotMeta {
  id: string;
  actorId: string | null;
  docCount: number;
  createdAt: Date;
}

/** قائمة نسخ مساحة العمل (وصفيّة، بلا نصّ خام). fail-open → [] عند غياب الجدول. */
export async function listSnapshots(workspaceId: string): Promise<SnapshotMeta[]> {
  try {
    return await prisma.docToolSnapshot.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      select: { id: true, actorId: true, docCount: true, createdAt: true }
    });
  } catch {
    return [];
  }
}

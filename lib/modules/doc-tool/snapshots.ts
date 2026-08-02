// أرشيف نسخ أداة الوثائق: يحفظ لقطةً كاملة عند كل حفظ (تاريخٌ لا يُستبدَل)، ويحمي من
// تضخّم التخزين بثلاث ضوابط: (١) تخطّي اللقطة المتطابقة مع الأحدث (بصمة المحتوى)،
// (٢) سقفٌ لحجم اللقطة الواحدة (لا نؤرشف مجاميع ضخمة)، (٣) تقليمٌ بعددٍ وميزانيّةِ بايت.
// fail-open تمامًا: أيّ خطأ (منها غياب الجدول قبل تجهيز المخطط) يُبتلع فلا يتأثّر الحفظ.
// مُفعَّل افتراضيًا، إيقاف طارئ: HAKEEM_DOC_TOOL_VERSIONS_V1=0.

import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { retainWithinBudget } from "@/lib/modules/doc-tool/snapshot-retention";

/** آخر عددٍ من النسخ يُحتفَظ به لكل مساحة عمل. */
export const SNAPSHOT_KEEP = 10;
/** ميزانيّة البايت الإجماليّة لكل مساحة عمل (تقليمٌ بها إضافةً للعدد). */
export const SNAPSHOT_MAX_TOTAL_BYTES = 8_000_000; // ~8MB
/** سقف حجم اللقطة الواحدة — لا نؤرشف مجاميع أكبر (كبح تضخّم صفوف Postgres). */
export const SNAPSHOT_MAX_SINGLE_BYTES = 4_000_000; // ~4MB

function enabled(): boolean {
  const v = (process.env.HAKEEM_DOC_TOOL_VERSIONS_V1 ?? "").trim().toLowerCase();
  return !(v === "0" || v === "false" || v === "off" || v === "no");
}

/** يؤرشف لقطة الحفظ (بضوابط التضخّم) ثم يقلّم القديم. لا يعطّل الحفظ أبدًا (fail-open). */
export async function archiveSnapshot(input: {
  workspaceId: string;
  actorId?: string;
  docs: unknown;
  docCount: number;
}): Promise<void> {
  if (!enabled()) return;
  try {
    const serialized = JSON.stringify(input.docs ?? []);
    const byteSize = Buffer.byteLength(serialized, "utf8");
    // سقف اللقطة الواحدة: مجموعٌ ضخمٌ لا يُؤرشَف محتواه (السجلّ التدقيقيّ يبقى يوثّق العمليّة).
    if (byteSize > SNAPSHOT_MAX_SINGLE_BYTES) return;
    const contentHash = createHash("sha256").update(serialized).digest("hex");

    // تخطّي المتطابق: إن كانت الأحدث بنفس البصمة فلا فائدة من صفٍّ جديد (كبح تكرار الحفظ).
    const latest = await prisma.docToolSnapshot.findFirst({
      where: { workspaceId: input.workspaceId },
      orderBy: { createdAt: "desc" },
      select: { contentHash: true }
    });
    if (latest?.contentHash === contentHash) return;

    await prisma.docToolSnapshot.create({
      data: {
        workspaceId: input.workspaceId,
        actorId: input.actorId,
        docs: input.docs as Prisma.InputJsonValue,
        docCount: input.docCount,
        contentHash,
        byteSize
      }
    });

    // تقليمٌ بالعدد والميزانيّة معًا (الأحدث أوّلًا).
    const rows = await prisma.docToolSnapshot.findMany({
      where: { workspaceId: input.workspaceId },
      orderBy: { createdAt: "desc" },
      select: { id: true, byteSize: true }
    });
    const stale = retainWithinBudget(
      rows.map((r) => ({ id: r.id, bytes: r.byteSize ?? 0 })),
      SNAPSHOT_KEEP,
      SNAPSHOT_MAX_TOTAL_BYTES
    );
    if (stale.length) {
      await prisma.docToolSnapshot.deleteMany({ where: { id: { in: stale.map((s) => s.id) } } });
    }
  } catch {
    /* fail-open: الأرشفة لا تعطّل الحفظ (منها: الجدول/العمود غير مُهيّأ بعد) */
  }
}

/** بيانات نسخةٍ وصفيّة (بلا محتوى) — للعرض في واجهة/لوحة لاحقًا. */
export interface SnapshotMeta {
  id: string;
  actorId: string | null;
  docCount: number;
  byteSize: number | null;
  createdAt: Date;
}

/** قائمة نسخ مساحة العمل (وصفيّة، بلا نصّ خام). fail-open → [] عند غياب الجدول. */
export async function listSnapshots(workspaceId: string): Promise<SnapshotMeta[]> {
  try {
    return await prisma.docToolSnapshot.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      select: { id: true, actorId: true, docCount: true, byteSize: true, createdAt: true }
    });
  } catch {
    return [];
  }
}

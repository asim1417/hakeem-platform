import { AttachmentsManager } from "@/components/AttachmentsManager";
import { prisma } from "@/lib/prisma";
import { parseAttachmentMetadata } from "@/lib/modules/attachments/attachment-metadata";
import { attachmentListWhere, caseListWhere } from "@/lib/modules/auth/ownership";
import { requirePagePermission } from "@/lib/modules/auth/session";

export const dynamic = "force-dynamic";

export default async function AttachmentsPage() {
  const user = await requirePagePermission("ATTACHMENTS_LIMITED");
  const [attachments, cases] = await Promise.all([
    prisma.attachment
      .findMany({
        where: attachmentListWhere(user),
        orderBy: { createdAt: "desc" },
        take: 100,
        include: { caseFile: { select: { id: true, title: true } } }
      })
      .then((items) =>
        items.map((item) => ({
          id: item.id,
          fileName: item.fileName,
          mimeType: item.mimeType,
          storageKey: item.storageKey,
          createdAt: item.createdAt.toISOString(),
          caseFile: item.caseFile,
          ...parseAttachmentMetadata(item.extractedText)
        }))
      )
      .catch(() => []),
    prisma.caseFile
      .findMany({
        where: caseListWhere(user),
        orderBy: { updatedAt: "desc" },
        take: 50,
        select: { id: true, title: true }
      })
      .catch(() => [])
  ]);

  return (
    <div>
      <p className="text-sm font-semibold text-gold">المرفقات والبينات</p>
      <h1 className="mt-2 text-3xl font-bold text-olive">المرفقات</h1>
      <p className="mt-3 max-w-3xl leading-8 text-ink">
        واجهة MVP لتسجيل بيانات المرفقات وربطها بالقضايا أو المسارات الأخرى دون تخزين دائم للملفات.
      </p>
      <div className="mt-6">
        <AttachmentsManager initialAttachments={attachments} cases={cases} />
      </div>
    </div>
  );
}

import { AttachmentsManager } from "@/components/AttachmentsManager";
import { prisma } from "@/lib/prisma";
import { toAttachmentDto } from "@/lib/modules/attachments/attachment-metadata";
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
        items.map((item) => {
          const dto = toAttachmentDto(item);
          return {
            ...dto,
            createdAt: typeof dto.createdAt === "string" ? dto.createdAt : dto.createdAt.toISOString()
          };
        })
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
      <p className="text-sm font-semibold text-gold">منصة الوثائق</p>
      <h1 className="mt-2 text-3xl font-bold text-olive">منصة الوثائق</h1>
      <p className="mt-3 max-w-3xl leading-8 text-ink">
        رفع المرفقات وربطها بالقضايا أو المسارات الأخرى. المسار القديم `/dashboard/attachments` محفوظ دون كسر.
      </p>
      <div className="mt-6">
        <AttachmentsManager initialAttachments={attachments} cases={cases} />
      </div>
    </div>
  );
}

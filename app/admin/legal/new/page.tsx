import { AdminPageShell } from "@/components/admin/AdminPageShell";
import { DeskHeader, DeskNav } from "@/components/editorial/DeskNav";
import { ReadOnlyBanner } from "@/components/editorial/ui";
import { WorkStatusForm } from "@/components/editorial/WorkStatusForm";
import { requireEditorialPage } from "@/lib/modules/editorial/guard";
import { isEditorialWriteEnabled } from "@/lib/modules/editorial/write-gate";

export const dynamic = "force-dynamic";

export default async function NewWorkStatusPage() {
  await requireEditorialPage("propose");
  const writeEnabled = isEditorialWriteEnabled();
  return (
    <AdminPageShell currentPath="/admin/legal">
      <DeskHeader
        title="تغيير حالة نظام"
        lead="الفعل التجريبي للمرحلة صفر. لا تُحفظ حالة بلا أداة ورابطها واقتباسها، ويُشتق ترتيب حجية المصدر من الرابط: أم القرى ثم هيئة الخبراء ثم الجهة."
      />
      <DeskNav current="/admin/legal/new" />
      <ReadOnlyBanner writeEnabled={writeEnabled} />
      <div className="mt-6 max-w-3xl rounded-xl border border-[rgba(14,52,53,0.12)] bg-white p-4 sm:p-6">
        <WorkStatusForm writeEnabled={writeEnabled} />
      </div>
    </AdminPageShell>
  );
}

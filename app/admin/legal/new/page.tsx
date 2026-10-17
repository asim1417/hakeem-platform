import { DeskHeader, DeskNav, deskNavAccess } from "@/components/editorial/DeskNav";
import { DeskRoot, PageDenied, ReadOnlyBanner } from "@/components/editorial/ui";
import { WorkStatusForm } from "@/components/editorial/WorkStatusForm";
import { canProposeLaws } from "@/lib/modules/editorial/access";
import { requireEditorialPage } from "@/lib/modules/editorial/guard";
import { isEditorialWriteEnabled } from "@/lib/modules/editorial/write-gate";

export const dynamic = "force-dynamic";

export default async function NewWorkStatusPage() {
  // الصلاحية المرفوضة تُعرض داخل الصفحة بلا تحويل (ق١٥-٢)؛ من لا يرى المكتب أصلًا يُحوَّل كما كان.
  const actor = await requireEditorialPage("view");
  const allowed = canProposeLaws(actor.access);
  const writeEnabled = isEditorialWriteEnabled();
  return (
    <DeskRoot>
      <DeskHeader
        title="تغيير حالة نظام"
        lead="الفعل التجريبي للمرحلة صفر. لا تُحفظ حالة بلا أداة ورابطها واقتباسها، ويُشتق ترتيب حجية المصدر من الرابط: أم القرى ثم هيئة الخبراء ثم الجهة."
      />
      <DeskNav current="/admin/legal/new" access={deskNavAccess(actor.access)} />
      {allowed ? (
        <>
          <ReadOnlyBanner writeEnabled={writeEnabled} />
          <div className="dk-card mt-6 max-w-3xl">
            <WorkStatusForm writeEnabled={writeEnabled} />
          </div>
        </>
      ) : (
        <PageDenied title="لا تملك صلاحية اقتراح تغيير." />
      )}
    </DeskRoot>
  );
}

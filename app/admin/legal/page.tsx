import { DeskCounters } from "@/components/editorial/DeskCounters";
import { DeskHeader, DeskNav, deskNavAccess } from "@/components/editorial/DeskNav";
import { ACTOR_KIND_LABEL, auditActionLabel, objectTypeLabel } from "@/components/editorial/labels";
import { fmtDateTime } from "@/components/editorial/logic";
import { DeskRoot, LoadFailed, Ltr, Message, NotMigrated, ReadOnlyBanner } from "@/components/editorial/ui";
import { canReadAudit } from "@/lib/modules/editorial/access";
import { editorialDb, requireEditorialPage, deskPageWriteContext } from "@/lib/modules/editorial/guard";
import { intakeCounts } from "@/lib/modules/editorial/intake";
import { loadEditorialConfig } from "@/lib/modules/editorial/policy";
import { deskCounts, listAudit } from "@/lib/modules/editorial/read";

export const dynamic = "force-dynamic";

export default async function EditorialDeskPage() {
  const actor = await requireEditorialPage("view");
  const db = editorialDb();
  const { writeEnabled, banner } = await deskPageWriteContext(actor);
  const auditAllowed = canReadAudit(actor.access);
  const [desk, intake, audit] = await Promise.all([
    deskCounts(db),
    intakeCounts(db).catch(() => null),
    auditAllowed ? listAudit(db, actor, { limit: 8 }).catch(() => null) : Promise.resolve(null),
  ]);
  // deskCounts يعيد null لأي خطأ؛ فيُميَّز «الترحيل غير مطبّق» (جدول الإعدادات غير موجود) عن تعذّر القراءة (ق١٤-٣).
  const migrated = desk === null ? await loadEditorialConfig(db).then((c) => c.installed, () => null) : true;

  return (
    <DeskRoot>
      <DeskHeader
        title="لوحة الحالة"
        lead="كل تغيير على الأنظمة والأحكام يمر بمُعِدّ ثم معتمِد غير المُعِدّ، ويُنشر صفًّا جديدًا بسنده، ويُسجّل في سجل لا يُعدَّل."
      />
      <DeskNav current="/admin/legal" access={deskNavAccess(actor.access)} />
      <ReadOnlyBanner {...banner} />
      {desk === null ? (
        <div className="mt-4">
          {migrated === false ? <NotMigrated /> : <LoadFailed what="قراءة عدّادات المكتب" retryHref="/admin/legal" />}
        </div>
      ) : null}

      <DeskCounters desk={desk} intake={intake} auditAllowed={auditAllowed} />

      {/* HKM-023-A: لوحة العدّادات الموحدة للأنظمة والأحكام تُركَّب هنا مكوّنًا مستقلًا تحت عدّادات المكتب. */}

      {auditAllowed ? (
        <>
          <h2 className="dk-h2">آخر الأحداث</h2>
          {audit === null ? (
            <div className="mt-3">
              <Message tone="info">سجل المكتب غير متاح على هذه القاعدة.</Message>
            </div>
          ) : audit.length ? (
            <ol className="dk-rows">
              {audit.map((event) => (
                <li key={event.id}>
                  <div className="dk-row__top">
                    <span className="dk-row__title">{auditActionLabel(event.action)}</span>
                    <time className="dk-meta dk-nowrap" dateTime={new Date(event.at).toISOString()}>
                      {fmtDateTime(event.at)}
                    </time>
                  </div>
                  <p className="dk-meta">
                    {objectTypeLabel(event.object_type)} <Ltr>{event.object_id}</Ltr> · {ACTOR_KIND_LABEL[event.actor_kind] ?? "منفّذ"}
                  </p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-3 dk-meta">لا أحداث بعد.</p>
          )}
        </>
      ) : null}
    </DeskRoot>
  );
}

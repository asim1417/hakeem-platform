import Link from "next/link";
import { ArrowLeft, Info } from "lucide-react";
import { DeskHeader, DeskNav, deskNavAccess } from "@/components/editorial/DeskNav";
import { ACTOR_KIND_LABEL, auditActionLabel, objectTypeLabel } from "@/components/editorial/labels";
import { fmt, fmtDateTime } from "@/components/editorial/logic";
import { DeskRoot, Ltr, Message, ReadOnlyBanner } from "@/components/editorial/ui";
import { canReadAudit } from "@/lib/modules/editorial/access";
import { editorialDb, requireEditorialPage } from "@/lib/modules/editorial/guard";
import { intakeCounts } from "@/lib/modules/editorial/intake";
import { deskCounts, listAudit } from "@/lib/modules/editorial/read";
import { isEditorialWriteEnabled } from "@/lib/modules/editorial/write-gate";

export const dynamic = "force-dynamic";

/** بطاقة إحصاء: null = المصدر غير متاح («—» و«غير متاح»، لا صفر)؛ الرابطة بسهم ونص مخفي (ق١٠، ق٢٠). */
function Stat({ label, value, href }: { label: string; value: number | null; href?: string }) {
  const body = (
    <>
      <span className="dk-label">{label}</span>
      {value === null ? (
        <span>
          <span className="dk-stat__value dk-stat__value--na">—</span>
          <span className="dk-stat__na dk-meta">
            <Info size={16} aria-hidden />
            غير متاح<span className="dk-sr"> — المصدر غير متاح على هذه القاعدة</span>
          </span>
        </span>
      ) : (
        <span className="dk-stat__value">
          <span>{fmt(value)}</span>
          {href ? <ArrowLeft size={20} aria-hidden /> : null}
        </span>
      )}
    </>
  );
  if (href && value !== null) {
    return (
    <Link href={href} className="dk-stat">
      {body}
      <span className="dk-sr"> — افتح الطابور</span>
    </Link>
  );
}
return <div className="dk-stat">{body}</div>;
}

export default async function EditorialDeskPage() {
const actor = await requireEditorialPage("view");
const db = editorialDb();
const writeEnabled = isEditorialWriteEnabled();
const auditAllowed = canReadAudit(actor.access);
const [desk, intake, audit] = await Promise.all([
  deskCounts(db),
  intakeCounts(db).catch(() => null),
  auditAllowed ? listAudit(db, actor, { limit: 8 }).catch(() => null) : Promise.resolve(null),
]);

return (
    <DeskRoot>
      <DeskHeader
        title="لوحة الحالة"
        lead="كل تغيير على الأنظمة والأحكام يمر بمُعِدّ ثم معتمِد غير المُعِدّ، ويُنشر صفًّا جديدًا بسنده، ويُسجّل في سجل لا يُعدَّل."
      />
      <DeskNav current="/admin/legal" access={deskNavAccess(actor.access)} />
      <ReadOnlyBanner writeEnabled={writeEnabled} />
      {desk === null ? (
        <div className="mt-4">
          <Message tone="info" title="جداول مكتب التحرير غير متاحة على هذه القاعدة.">
            إن لم يُطبَّق الترحيل بعد فيُطبَّق بملفه وباعتماد المالك؛ وعدّادات الدفعات أدناه «غير متاح» حتى ذلك.
          </Message>
        </div>
      ) : null}

      <h2 className="dk-h2">مقترحات الذكاء الاصطناعي المعلّقة</h2>
      <div className="dk-stats">
        <Stat label="عمليات تعديل بلا قرار" value={intake?.amendmentOpsUndecided ?? null} href="/admin/legal/queue?tab=amendments" />
        <Stat label="منها تقبل الاعتماد الجماعي" value={intake?.amendmentOpsBulkEligible ?? null} href="/admin/legal/queue?tab=amendments&bulk=1" />
        <Stat label="مبادئ تنتظر المراجعة" value={intake?.principlesNeedsReview ?? null} href="/admin/legal/queue?tab=principles" />
        <Stat label="روابط أحكام بالمواد (طابورها لاحقًا)" value={intake?.caseLinksNeedsReview ?? null} />
        <Stat label="آثار لم تُستخرج آليًّا (يدوي)" value={intake?.manualEffects ?? null} />
        <Stat label="علاقات آلية «مرتبطة»" value={intake?.autoRelations ?? null} />
      </div>

      <h2 className="dk-h2">دفعات المحررين</h2>
      <div className="dk-stats dk-stats--4">
        <Stat label="في الطابور" value={desk?.pending ?? null} href="/admin/legal/queue?tab=changes" />
        <Stat label="معتمدة تنتظر النشر" value={desk?.approved ?? null} href="/admin/legal/queue?tab=changes" />
        <Stat label="فشلت فحوصها" value={desk?.checksFailed ?? null} href="/admin/legal/queue?tab=changes" />
        <Stat label="نُشرت اليوم" value={desk?.publishedToday ?? null} />
        <Stat label="مسودات" value={desk?.draft ?? null} />
        <Stat label="مزامنة فهارس معلّقة" value={desk?.indexSyncPending ?? null} />
        <Stat label="أحداث السجل اليوم" value={desk?.auditToday ?? null} href={auditAllowed ? "/admin/legal/audit" : undefined} />
      </div>

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

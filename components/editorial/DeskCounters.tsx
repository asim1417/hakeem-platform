import Link from "next/link";
import { ArrowLeft, Info } from "lucide-react";
import { fmt } from "@/components/editorial/logic";
import type { DeskCounts, IntakeCountsView } from "@/lib/modules/editorial/read";

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

/**
 * عدّادات مكتب التحرير وحدها (مقترحات الذكاء الاصطناعي ودفعات المحررين) في قسم مستقل بمعرّف ثابت.
 * لا عدّادات عامة للأنظمة والأحكام هنا: تلك لوحة خدمة العدّ الموحدة (HKM-023-A) وتُركَّب في صفحة اللوحة
 * تحت هذا القسم مكوّنًا مستقلًا، فلا يمس دمجها هذا الملف.
 */
export function DeskCounters({
  desk,
  intake,
  auditAllowed,
}: {
  desk: DeskCounts | null;
  intake: IntakeCountsView | null;
  auditAllowed: boolean;
}) {
  return (
    <section id="desk-counters" aria-label="عدّادات مكتب التحرير" data-desk-section="desk-counters">
      <h2 className="dk-h2">مقترحات الذكاء الاصطناعي المعلّقة</h2>
      <div className="dk-stats">
        <Stat label="عمليات تعديل بلا قرار" value={intake?.amendmentOpsUndecided ?? null} href="/admin/legal/queue?tab=amendments" />
        <Stat label="منها تقبل الاعتماد الجماعي" value={intake?.amendmentOpsBulkEligible ?? null} href="/admin/legal/queue?tab=amendments&bulk=1" />
        {/* «مبادئ بانتظار المراجعة» و«استشهادات بانتظار الاعتماد» تُعرض مرة واحدة في لوحة خدمة العدّ تحت هذا القسم
            (HKM-023-A، مراجعة الجودة ع٢)، وعدّاد المبادئ هناك يفتح طابور المكتب نفسه. */}
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
    </section>
  );
}

import Link from "next/link";
import { AdminPageShell } from "@/components/admin/AdminPageShell";
import { DeskHeader, DeskNav } from "@/components/editorial/DeskNav";
import { Notice, ReadOnlyBanner } from "@/components/editorial/ui";
import { editorialDb, requireEditorialPage } from "@/lib/modules/editorial/guard";
import { intakeCounts } from "@/lib/modules/editorial/intake";
import { deskCounts, listAudit } from "@/lib/modules/editorial/read";
import { isEditorialWriteEnabled } from "@/lib/modules/editorial/write-gate";

export const dynamic = "force-dynamic";

const fmt = (n: number) => n.toLocaleString("ar-SA");

function Stat({ label, value, href, tone = "neutral" }: { label: string; value: number | null; href?: string; tone?: "neutral" | "gold" | "good" }) {
  const tones = { neutral: "text-[#0E3435]", gold: "text-[#8B6914]", good: "text-[#1A5C41]" };
  const body = (
    <div className="h-full rounded-xl border border-[rgba(14,52,53,0.12)] bg-white p-4">
      <p className="text-xs font-semibold text-[rgba(18,33,31,0.6)]">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${tones[tone]}`}>{value === null ? "—" : fmt(value)}</p>
    </div>
  );
  return href ? (
    <Link href={href} className="block rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C69763]">
      {body}
    </Link>
  ) : (
    body
  );
}

export default async function EditorialDeskPage() {
  await requireEditorialPage("view");
  const db = editorialDb();
  const writeEnabled = isEditorialWriteEnabled();
  const [desk, intake, audit] = await Promise.all([
    deskCounts(db),
    intakeCounts(db).catch(() => null),
    listAudit(db, { limit: 8 }).catch(() => null),
  ]);

  return (
    <AdminPageShell currentPath="/admin/legal">
      <DeskHeader
        title="لوحة الحالة"
        lead="كل تغيير على الأنظمة والأحكام يمر بمُعِدّ ثم معتمِد غير المُعِدّ، ويُنشر صفًّا جديدًا بسنده، ويُسجّل في سجل لا يُعدَّل."
      />
      <DeskNav current="/admin/legal" />
      <ReadOnlyBanner writeEnabled={writeEnabled} />
      {desk === null ? (
        <div className="mt-4">
          <Notice>جداول مكتب التحرير غير مطبّقة على هذه القاعدة بعد؛ تُطبَّق بملف الترحيل وباعتماد المالك.</Notice>
        </div>
      ) : null}

      <h2 className="mt-8 text-lg font-bold text-[#0E3435]">مقترحات الذكاء الاصطناعي المعلّقة</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat label="عمليات تعديل بلا قرار" value={intake?.amendmentOpsUndecided ?? null} href="/admin/legal/queue?tab=amendments" tone="gold" />
        <Stat label="منها تقبل الاعتماد الجماعي" value={intake?.amendmentOpsBulkEligible ?? null} href="/admin/legal/queue?tab=amendments&bulk=1" />
        <Stat label="مبادئ تنتظر المراجعة" value={intake?.principlesNeedsReview ?? null} href="/admin/legal/queue?tab=principles" tone="gold" />
        <Stat label="روابط أحكام بالمواد (طابورها لاحقًا)" value={intake?.caseLinksNeedsReview ?? null} />
        <Stat label="آثار لم تُستخرج آليًّا (يدوي)" value={intake?.manualEffects ?? null} />
        <Stat label="علاقات آلية «مرتبطة»" value={intake?.autoRelations ?? null} />
      </div>
      {intake?.unavailable.length ? (
        <p className="mt-2 text-xs text-[rgba(18,33,31,0.55)]">غير متاح على هذه القاعدة: {intake.unavailable.join("، ")}</p>
      ) : null}

      <h2 className="mt-8 text-lg font-bold text-[#0E3435]">دفعات المحررين</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="في الطابور" value={desk?.pending ?? null} href="/admin/legal/queue?tab=changes" tone="gold" />
        <Stat label="معتمدة تنتظر النشر" value={desk?.approved ?? null} href="/admin/legal/queue?tab=changes" />
        <Stat label="فشلت فحوصها" value={desk?.checksFailed ?? null} href="/admin/legal/queue?tab=changes" />
        <Stat label="نُشرت اليوم" value={desk?.publishedToday ?? null} tone="good" />
        <Stat label="مسودات" value={desk?.draft ?? null} />
        <Stat label="مزامنة فهارس معلّقة" value={desk?.indexSyncPending ?? null} />
        <Stat label="أحداث السجل اليوم" value={desk?.auditToday ?? null} href="/admin/legal/audit" />
      </div>

      <h2 className="mt-8 text-lg font-bold text-[#0E3435]">آخر الأحداث</h2>
      {audit?.length ? (
        <ul className="mt-3 divide-y divide-[rgba(14,52,53,0.08)] rounded-xl border border-[rgba(14,52,53,0.12)] bg-white">
          {audit.map((event) => (
            <li key={event.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
              <span className="font-semibold text-[#0E3435]">{event.action}</span>
              <span className="text-[rgba(18,33,31,0.6)]">
                {event.object_type} · {new Date(event.at).toLocaleString("ar-SA", { timeZone: "Asia/Riyadh" })}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-[rgba(18,33,31,0.6)]">لا أحداث بعد.</p>
      )}
    </AdminPageShell>
  );
}

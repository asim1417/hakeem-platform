import { AdminPageShell } from "@/components/admin/AdminPageShell";
import { DeskHeader, DeskNav } from "@/components/editorial/DeskNav";
import { Ltr, Notice } from "@/components/editorial/ui";
import { editorialDb, requireEditorialPage } from "@/lib/modules/editorial/guard";
import { listAudit } from "@/lib/modules/editorial/read";

export const dynamic = "force-dynamic";

const OBJECT_TYPES = ["", "change_set", "work", "amendment_op", "principle", "route"];

export default async function EditorialAuditPage({ searchParams = {} }: { searchParams?: { action?: string; objectType?: string; actor?: string } }) {
  await requireEditorialPage("view");
  const rows = await listAudit(editorialDb(), {
    action: searchParams.action,
    objectType: searchParams.objectType,
    actor: searchParams.actor,
    limit: 200,
  }).catch(() => null);

  return (
    <AdminPageShell currentPath="/admin/legal">
      <DeskHeader title="سجل التدقيق" lead="كل فعل في المكتب مسجّل هنا، والقاعدة نفسها ترفض تعديل السجل أو حذفه." />
      <DeskNav current="/admin/legal/audit" />
      <form method="get" className="mt-6 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-[rgba(18,33,31,0.6)]">الفعل يبدأ بـ</span>
          <input name="action" dir="ltr" defaultValue={searchParams.action ?? ""} placeholder="intake." className="min-h-[44px] w-44 rounded-md border border-[rgba(14,52,53,0.15)] bg-white px-3" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-[rgba(18,33,31,0.6)]">نوع الهدف</span>
          <select name="objectType" defaultValue={searchParams.objectType ?? ""} className="min-h-[44px] rounded-md border border-[rgba(14,52,53,0.15)] bg-white px-3">
            {OBJECT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t || "الكل"}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-[rgba(18,33,31,0.6)]">المنفّذ</span>
          <input name="actor" dir="ltr" defaultValue={searchParams.actor ?? ""} className="min-h-[44px] w-44 rounded-md border border-[rgba(14,52,53,0.15)] bg-white px-3" />
        </label>
        <button type="submit" className="min-h-[44px] rounded-md bg-[#0E3435] px-4 text-sm font-semibold text-white">
          تطبيق
        </button>
      </form>
      <div className="mt-4">
        {rows === null ? (
          <Notice>سجل المكتب غير مطبّق على هذه القاعدة بعد.</Notice>
        ) : rows.length === 0 ? (
          <Notice>لا أحداث بهذه المرشحات.</Notice>
        ) : (
          <ol className="divide-y divide-[rgba(14,52,53,0.08)] rounded-xl border border-[rgba(14,52,53,0.12)] bg-white">
            {rows.map((row) => (
              <li key={row.id} className="grid gap-1 px-4 py-3 text-sm sm:grid-cols-[1fr_auto]">
                <div className="min-w-0">
                  <p className="font-semibold text-[#0E3435]">
                    <Ltr>{row.action}</Ltr>
                  </p>
                  <p className="break-all text-[rgba(18,33,31,0.65)]">
                    {row.object_type}: <Ltr>{row.object_id}</Ltr> · {row.actor_kind === "agent" ? "وكيل" : row.actor_kind === "system" ? "النظام" : "بشري"}{" "}
                    {row.actor_id ? <Ltr>{row.actor_id}</Ltr> : null}
                  </p>
                  {row.after_hash ? (
                    <p className="text-xs text-[rgba(18,33,31,0.5)]">
                      بصمة بعد: <Ltr>{row.after_hash.slice(0, 12)}</Ltr>
                    </p>
                  ) : null}
                </div>
                <time className="text-xs text-[rgba(18,33,31,0.6)]" dateTime={new Date(row.at).toISOString()}>
                  {new Date(row.at).toLocaleString("ar-SA", { timeZone: "Asia/Riyadh" })}
                </time>
              </li>
            ))}
          </ol>
        )}
      </div>
    </AdminPageShell>
  );
}

import { AdminPageShell } from "@/components/admin/AdminPageShell";
import { requirePagePermission } from "@/lib/modules/auth/session";
import { listRasdChanges } from "@/lib/modules/rasd/admin-data";

export const dynamic = "force-dynamic";

function text(value: unknown): string {
  if (value instanceof Date) return value.toLocaleString("ar-SA");
  return value == null ? "—" : String(value);
}

export default async function RasdReviewsPage() {
  await requirePagePermission("RASD_VIEW");
  const changes = await listRasdChanges();

  return (
    <AdminPageShell currentPath="/admin/rasd/reviews">
      <section dir="rtl">
        <h1 className="text-3xl font-bold text-[#0E3435]">مراجعات التحديثات</h1>
        <p className="mt-2 text-sm text-[rgba(14,52,53,0.65)]">قائمة التغييرات التي تحتاج قراراً قبل التطبيق.</p>
        <div className="mt-6 rounded-[0.75rem] border border-[rgba(14,52,53,0.1)] bg-[#FFFcf7]">
          {changes.length === 0 ? (
            <p className="p-6 text-sm text-[rgba(14,52,53,0.55)]">لا توجد تغييرات معلقة.</p>
          ) : (
            <ul className="divide-y divide-[rgba(14,52,53,0.08)]">
              {changes.map((change) => (
                <li key={text(change.id)} className="px-5 py-4">
                  <div className="flex flex-wrap justify-between gap-2">
                    <p className="font-semibold text-[#0E3435]">{text(change.changeType)}</p>
                    <span className="text-xs text-[rgba(14,52,53,0.55)]">{text(change.severity)} · {text(change.reviewStatus)}</span>
                  </div>
                  <p className="mt-1 text-sm text-[rgba(14,52,53,0.65)]">اكتشف في: {text(change.detectedAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </AdminPageShell>
  );
}

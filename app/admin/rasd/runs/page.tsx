import { AdminPageShell } from "@/components/admin/AdminPageShell";
import { requirePagePermission } from "@/lib/modules/auth/session";
import { listRasdRuns } from "@/lib/modules/rasd/admin-data";

export const dynamic = "force-dynamic";

function text(value: unknown): string {
  if (value instanceof Date) return value.toLocaleString("ar-SA");
  return value == null ? "—" : String(value);
}

export default async function RasdRunsPage() {
  await requirePagePermission("RASD_VIEW");
  const runs = await listRasdRuns();

  return (
    <AdminPageShell currentPath="/admin/rasd/runs">
      <section dir="rtl">
        <h1 className="text-3xl font-bold text-[#0E3435]">تشغيلات رصد</h1>
        <p className="mt-2 text-sm text-[rgba(14,52,53,0.65)]">سجل التشغيلات اليدوية والأسبوعية وخط الأساس.</p>
        <div className="mt-6 overflow-hidden rounded-[0.75rem] border border-[rgba(14,52,53,0.1)] bg-[#FFFcf7]">
          {runs.length === 0 ? (
            <p className="p-6 text-sm text-[rgba(14,52,53,0.55)]">لا توجد تشغيلات بعد أو جداول رصد غير مهيأة.</p>
          ) : (
            <ul className="divide-y divide-[rgba(14,52,53,0.08)]">
              {runs.map((run) => (
                <li key={text(run.id)} className="grid gap-2 px-5 py-4 md:grid-cols-5">
                  <span className="font-semibold text-[#0E3435]">{text(run.runType)}</span>
                  <span>{text(run.status)}</span>
                  <span>اكتشف: {text(run.documentsDiscovered)}</span>
                  <span>تغيّر: {text(run.documentsChanged)}</span>
                  <span className="text-xs text-[rgba(14,52,53,0.55)]">{text(run.startedAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </AdminPageShell>
  );
}

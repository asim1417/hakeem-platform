import { AdminPageShell } from "@/components/admin/AdminPageShell";
import { requirePagePermission } from "@/lib/modules/auth/session";
import { buildConflictReport } from "@/lib/modules/rasd/reports/conflicts";

export const dynamic = "force-dynamic";

export default async function RasdConflictsPage() {
  await requirePagePermission("RASD_VIEW");
  const report = await buildConflictReport();

  return (
    <AdminPageShell currentPath="/admin/rasd/conflicts">
      <section dir="rtl">
        <h1 className="text-3xl font-bold text-[#0E3435]">تعارضات المصادر</h1>
        <p className="mt-2 text-sm text-[rgba(14,52,53,0.65)]">اختلافات بين أم القرى وهيئة الخبراء والمركز الوطني.</p>
        <div className="mt-6 rounded-[0.75rem] border border-[rgba(14,52,53,0.1)] bg-[#FFFcf7]">
          {report.rows.length === 0 ? (
            <p className="p-6 text-sm text-[rgba(14,52,53,0.55)]">لا توجد تعارضات مفتوحة.</p>
          ) : (
            <ul className="divide-y divide-[rgba(14,52,53,0.08)]">
              {report.rows.map((row) => (
                <li key={row.conflictId} className="px-5 py-4">
                  <div className="flex flex-wrap justify-between gap-2">
                    <p className="font-semibold text-[#0E3435]">{row.fieldName}</p>
                    <span className="text-xs text-[rgba(14,52,53,0.55)]">{row.severity} · {row.status}</span>
                  </div>
                  <p className="mt-2 text-sm text-[rgba(14,52,53,0.65)]" dir="ltr">
                    BOE={row.boeValue ?? "—"} | NCAR={row.ncarValue ?? "—"} | UQN={row.uqnValue ?? "—"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </AdminPageShell>
  );
}

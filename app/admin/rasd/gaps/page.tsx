import { AdminPageShell } from "@/components/admin/AdminPageShell";
import { requirePagePermission } from "@/lib/modules/auth/session";
import { buildGapReport } from "@/lib/modules/rasd/reports/gaps";

export const dynamic = "force-dynamic";

export default async function RasdGapsPage() {
  await requirePagePermission("RASD_VIEW");
  const report = await buildGapReport();

  return (
    <AdminPageShell currentPath="/admin/rasd/gaps">
      <section dir="rtl">
        <h1 className="text-3xl font-bold text-[#0E3435]">فجوات المطابقة</h1>
        <p className="mt-2 text-sm text-[rgba(14,52,53,0.65)]">وثائق مرصودة لا تقابل نظاماً واضحاً في مكتبة حكيم.</p>
        <div className="mt-6 rounded-[0.75rem] border border-[rgba(14,52,53,0.1)] bg-[#FFFcf7]">
          {report.rows.length === 0 ? (
            <p className="p-6 text-sm text-[rgba(14,52,53,0.55)]">لا توجد فجوات حالياً.</p>
          ) : (
            <ul className="divide-y divide-[rgba(14,52,53,0.08)]">
              {report.rows.map((row) => (
                <li key={row.documentId} className="px-5 py-4">
                  <div className="flex flex-wrap justify-between gap-2">
                    <p className="font-semibold text-[#0E3435]">{row.title}</p>
                    <span className="text-xs text-[rgba(14,52,53,0.55)]">{row.matchStatus}</span>
                  </div>
                  <p className="mt-1 text-sm text-[rgba(14,52,53,0.65)]">{row.reason}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </AdminPageShell>
  );
}

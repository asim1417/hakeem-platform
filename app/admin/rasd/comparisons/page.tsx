import { AdminPageShell } from "@/components/admin/AdminPageShell";
import { requirePagePermission } from "@/lib/modules/auth/session";
import { buildCoverageReport } from "@/lib/modules/rasd/reports/coverage";

export const dynamic = "force-dynamic";

export default async function RasdComparisonsPage() {
  await requirePagePermission("RASD_VIEW");
  const report = await buildCoverageReport();

  return (
    <AdminPageShell currentPath="/admin/rasd/comparisons">
      <section dir="rtl">
        <h1 className="text-3xl font-bold text-[#0E3435]">المقارنات والتغطية</h1>
        <p className="mt-2 text-sm text-[rgba(14,52,53,0.65)]">نظرة على تغطية المصادر ومطابقتها مع مكتبة حكيم.</p>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {report.rows.length === 0 ? (
            <p className="rounded-[0.75rem] border border-[rgba(14,52,53,0.1)] bg-white p-6 text-sm text-[rgba(14,52,53,0.55)]">
              لا توجد بيانات تغطية بعد.
            </p>
          ) : (
            report.rows.map((row) => (
              <div key={row.sourceCode} className="rounded-[0.75rem] border border-[rgba(14,52,53,0.1)] bg-[#FFFcf7] p-5">
                <p className="text-lg font-bold text-[#0E3435]">{row.sourceCode}</p>
                <p className="mt-2 text-sm">الوثائق: {row.documents.toLocaleString("ar-SA")}</p>
                <p className="text-sm">مطابقة: {row.matched.toLocaleString("ar-SA")}</p>
                <p className="text-sm">غير مطابقة: {row.unmatched.toLocaleString("ar-SA")}</p>
              </div>
            ))
          )}
        </div>
      </section>
    </AdminPageShell>
  );
}

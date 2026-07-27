import { AdminPageShell } from "@/components/admin/AdminPageShell";
import { requirePagePermission } from "@/lib/modules/auth/session";
import { listRasdSources } from "@/lib/modules/rasd/admin-data";

export const dynamic = "force-dynamic";

function text(value: unknown): string {
  if (value instanceof Date) return value.toLocaleString("ar-SA");
  return value == null ? "—" : String(value);
}

export default async function RasdSourcesPage() {
  await requirePagePermission("ADMIN_REPORTS_VIEW");
  const sources = await listRasdSources();

  return (
    <AdminPageShell currentPath="/admin/rasd/sources">
      <section dir="rtl">
        <h1 className="text-3xl font-bold text-[#0E3435]">مصادر رصد</h1>
        <p className="mt-2 text-sm text-[rgba(14,52,53,0.65)]">تعريفات المصادر الرسمية وأولويتها وصحتها.</p>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {sources.length === 0 ? (
            <p className="rounded-[0.75rem] border border-[rgba(14,52,53,0.1)] bg-white p-6 text-sm text-[rgba(14,52,53,0.55)]">
              لا توجد مصادر بعد. شغّل seedRasdRegistry أو baseline fixtures.
            </p>
          ) : (
            sources.map((source) => (
              <article key={text(source.id)} className="rounded-[0.75rem] border border-[rgba(14,52,53,0.1)] bg-[#FFFcf7] p-5">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-lg font-bold text-[#0E3435]">{text(source.nameAr)}</h2>
                  <span className="text-xs text-[rgba(14,52,53,0.55)]">{text(source.code)}</span>
                </div>
                <p className="mt-2 text-sm">{text(source.baseDomain)}</p>
                <p className="text-sm">الأولوية: {text(source.trustPriority)}</p>
                <p className="text-sm">الحالة: {text(source.healthStatus)}</p>
              </article>
            ))
          )}
        </div>
      </section>
    </AdminPageShell>
  );
}

import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { SuperAdminNav } from "@/components/admin/SuperAdminNav";
import { requireSuperAdminPage } from "@/lib/modules/auth/super-admin";
import { listJobStats, listRecentJobs } from "@/lib/modules/jobs/job-store";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  running: "جارية",
  done: "مكتملة",
  error: "فاشلة",
};

export default async function AdminJobsPage() {
  await requireSuperAdminPage();
  const [stats, jobs] = await Promise.all([listJobStats(), listRecentJobs(50)]);

  const ownerIds = [...new Set(jobs.map((j) => j.ownerId))];
  const owners = ownerIds.length
    ? await prisma.user
        .findMany({
          where: { id: { in: ownerIds } },
          select: { id: true, name: true, email: true },
        })
        .catch(() => [])
    : [];
  const ownerMap = new Map(owners.map((o) => [o.id, o]));

  return (
    <AppShell>
      <SuperAdminNav currentPath="/admin/jobs" />
      <p className="text-sm font-semibold text-[#8B6914]">السوبر أدمن</p>
      <h1 className="mt-2 text-3xl font-bold text-[#0E3435]">مراقبة المهام الخلفية</h1>
      <p className="mt-3 max-w-3xl leading-8 text-[rgba(14,52,53,0.72)]">
        مهام التوليد والبحث المستأنفة من جدول generation_jobs — بيانات حقيقية من النظام.
      </p>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card label="الإجمالي" value={stats.total} />
        <Card label="جارية" value={stats.running} />
        <Card label="مكتملة" value={stats.done} />
        <Card label="فاشلة" value={stats.error} />
      </section>

      <section className="mt-6 overflow-hidden rounded-[0.75rem] border border-[rgba(14,52,53,0.1)] bg-[#FFFcf7]">
        {jobs.length === 0 ? (
          <p className="p-6 text-center text-sm text-[rgba(14,52,53,0.55)]">لا توجد مهام مسجّلة بعد.</p>
        ) : (
          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full min-w-[720px] border-collapse text-right text-sm">
              <thead className="sticky top-0 bg-[#F7F2EA]">
                <tr className="border-b border-[rgba(14,52,53,0.08)] [&>th]:px-4 [&>th]:py-3 [&>th]:font-semibold">
                  <th>النوع</th>
                  <th>الحالة</th>
                  <th>العنوان</th>
                  <th>المالك</th>
                  <th>آخر تحديث</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => {
                  const owner = ownerMap.get(job.ownerId);
                  return (
                    <tr key={job.id} className="border-b border-[rgba(14,52,53,0.06)]">
                      <td className="px-4 py-3 font-semibold text-[#0E3435]">{job.kind}</td>
                      <td className="px-4 py-3">{STATUS_LABEL[job.status] ?? job.status}</td>
                      <td className="px-4 py-3 text-[rgba(14,52,53,0.7)]">{job.title || "—"}</td>
                      <td className="px-4 py-3 text-[rgba(14,52,53,0.7)]">
                        {owner?.name || owner?.email || job.ownerId.slice(0, 8)}
                      </td>
                      <td className="px-4 py-3 text-xs text-[rgba(14,52,53,0.55)]">
                        {new Date(job.updatedAt).toLocaleString("ar-SA")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="mt-4 text-sm text-[rgba(14,52,53,0.55)]">
        استئناف مهمة فردية يبقى عبر{" "}
        <Link href="/dashboard" className="font-semibold text-[#8B6914]">
          واجهة المستخدم
        </Link>{" "}
        بمعرّف المالك — هذه الصفحة للمراقبة فقط.
      </p>
    </AppShell>
  );
}

function Card({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[0.75rem] border border-[rgba(14,52,53,0.1)] bg-[#FFFcf7] p-4">
      <p className="text-sm text-[rgba(14,52,53,0.55)]">{label}</p>
      <p className="mt-2 text-2xl font-bold text-[#0E3435]">{value.toLocaleString("ar-SA")}</p>
    </div>
  );
}

import { AdminPageShell } from "@/components/admin/AdminPageShell";
import { requireSuperAdminPage } from "@/lib/modules/auth/super-admin";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * صندوق بلاغات القاضي التفاعلي — سوبر أدمن فقط.
 * يقرأ نفس جدول bug_reports الذي يكتب إليه POST /api/original-hakeem/bug-report.
 */
export default async function AdminReportsPage() {
  await requireSuperAdminPage();

  let reports: Array<{
    id: string;
    type: string;
    description: string;
    suggestedFix: string | null;
    caseId: string | null;
    subject: string | null;
    stage: string | null;
    actorId: string | null;
    createdAt: Date;
  }> = [];

  try {
    reports = await prisma.bugReport.findMany({
      orderBy: { createdAt: "desc" },
      take: 80,
      select: {
        id: true,
        type: true,
        description: true,
        suggestedFix: true,
        caseId: true,
        subject: true,
        stage: true,
        actorId: true,
        createdAt: true,
      },
    });
  } catch {
    reports = [];
  }

  return (
    <AdminPageShell currentPath="/admin/reports">
      <p className="text-sm font-semibold text-[#8B6914]">السوبر أدمن</p>
      <h1 className="mt-2 text-3xl font-bold text-[#0E3435]">بلاغات الأخطاء</h1>
      <p className="mt-3 max-w-3xl leading-8 text-[rgba(14,52,53,0.72)]">
        وارد البلاغات من القاضي التفاعلي والمنصة — للقراءة والمتابعة دون مسار موازٍ للكتابة.
      </p>

      <section className="mt-6 overflow-hidden rounded-[0.75rem] border border-[rgba(14,52,53,0.1)] bg-[#FFFcf7]">
        <div className="border-b border-[rgba(14,52,53,0.08)] px-5 py-4">
          <h2 className="text-lg font-bold text-[#0E3435]">
            آخر البلاغات ({reports.length.toLocaleString("ar-SA")})
          </h2>
        </div>
        {reports.length === 0 ? (
          <p className="p-6 text-sm text-[rgba(14,52,53,0.55)]">
            لا بلاغات بعد، أو جدول bug_reports غير مُنشأ بعد.
          </p>
        ) : (
          <ul className="divide-y divide-[rgba(14,52,53,0.06)]">
            {reports.map((r) => (
              <li key={r.id} className="px-5 py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold text-[#0E3435]">{r.type}</p>
                  <time
                    className="text-xs text-[rgba(14,52,53,0.5)]"
                    dateTime={r.createdAt.toISOString()}
                  >
                    {r.createdAt.toLocaleString("ar-SA")}
                  </time>
                </div>
                {r.subject ? (
                  <p className="mt-1 text-sm text-[rgba(14,52,53,0.65)]">{r.subject}</p>
                ) : null}
                <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[#0E3435]">
                  {r.description}
                </p>
                {r.suggestedFix ? (
                  <p className="mt-2 text-sm text-[rgba(14,52,53,0.7)]">
                    اقتراح إصلاح: {r.suggestedFix}
                  </p>
                ) : null}
                <p className="mt-2 text-xs text-[rgba(14,52,53,0.45)]" dir="ltr">
                  {[
                    r.caseId ? `case=${r.caseId}` : null,
                    r.stage != null ? `stage=${r.stage}` : null,
                    r.actorId ? `actor=${r.actorId.slice(0, 8)}` : null,
                    `id=${r.id}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AdminPageShell>
  );
}

import { AppShell } from "@/components/AppShell";
import { SuperAdminNav } from "@/components/admin/SuperAdminNav";
import { requireSuperAdminPage } from "@/lib/modules/auth/super-admin";
import { prisma } from "@/lib/prisma";
import { auditActionLabel, auditSubjectLabel } from "@/lib/i18n/enum-labels";
import type { AuditSubject } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams?: { subject?: string; q?: string };
}) {
  await requireSuperAdminPage();

  const subject = searchParams?.subject?.trim();
  const q = searchParams?.q?.trim();

  const where = {
    ...(subject && subject !== "ALL"
      ? { subject: subject as AuditSubject }
      : {}),
    ...(q
      ? {
          OR: [
            { action: { contains: q, mode: "insensitive" as const } },
            { entityId: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const logs = await prisma.auditEvent
    .findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { actor: { select: { name: true, email: true } } },
    })
    .catch(() => []);

  const subjects = ["ALL", "ADMIN", "AUTH", "AI_GATEWAY", "CASE", "CONSULTATION", "SIMULATION", "LIBRARY", "TRAINING"];

  return (
    <AppShell>
      <SuperAdminNav currentPath="/admin/audit" />
      <p className="text-sm font-semibold text-[#8B6914]">السوبر أدمن</p>
      <h1 className="mt-2 text-3xl font-bold text-[#0E3435]">سجل التدقيق الإداري</h1>
      <p className="mt-3 max-w-3xl leading-8 text-[rgba(14,52,53,0.72)]">
        آخر 100 حدث من audit_logs مع تصفية اختيارية — بلا بيانات وهمية.
      </p>

      <form className="mt-6 flex flex-wrap gap-3" method="get">
        <label className="text-sm">
          <span className="mb-1 block text-[rgba(14,52,53,0.6)]">الوحدة</span>
          <select
            name="subject"
            defaultValue={subject || "ALL"}
            className="min-h-[44px] rounded-md border border-[rgba(14,52,53,0.15)] bg-white px-3"
          >
            {subjects.map((s) => (
              <option key={s} value={s}>
                {s === "ALL" ? "الكل" : auditSubjectLabel(s)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-[rgba(14,52,53,0.6)]">بحث في العملية</span>
          <input
            name="q"
            defaultValue={q || ""}
            placeholder="مثل USER_UPDATED"
            className="min-h-[44px] min-w-[220px] rounded-md border border-[rgba(14,52,53,0.15)] bg-white px-3"
          />
        </label>
        <button
          type="submit"
          className="mt-6 rounded-md bg-[#0E3435] px-4 py-2.5 text-sm font-semibold text-white"
        >
          تطبيق
        </button>
      </form>

      <section className="mt-6 overflow-hidden rounded-[0.75rem] border border-[rgba(14,52,53,0.1)] bg-[#FFFcf7]">
        {logs.length === 0 ? (
          <p className="p-6 text-center text-sm text-[rgba(14,52,53,0.55)]">لا توجد نتائج.</p>
        ) : (
          <div className="table-scroll max-h-[70vh] overflow-auto">
            <table className="w-full min-w-[760px] border-collapse text-right text-sm">
              <thead className="sticky top-0 bg-[#F7F2EA]">
                <tr className="border-b border-[rgba(14,52,53,0.08)] [&>th]:px-4 [&>th]:py-3 [&>th]:font-semibold">
                  <th>العملية</th>
                  <th>الوحدة</th>
                  <th>الوصف</th>
                  <th>المستخدم</th>
                  <th>التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-[rgba(14,52,53,0.06)]">
                    <td className="px-4 py-3 font-semibold text-[#0E3435]">{auditActionLabel(log.action)}</td>
                    <td className="px-4 py-3">{auditSubjectLabel(log.subject)}</td>
                    <td className="px-4 py-3 text-[rgba(14,52,53,0.7)]">{describeMeta(log.metadata)}</td>
                    <td className="px-4 py-3">{log.actor?.name || log.actor?.email || "—"}</td>
                    <td className="px-4 py-3 text-xs text-[rgba(14,52,53,0.55)]">
                      {log.createdAt.toLocaleString("ar-SA")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AppShell>
  );
}

function describeMeta(metadata: unknown): string {
  if (!metadata || typeof metadata !== "object") return "—";
  const desc = (metadata as { description?: unknown }).description;
  return typeof desc === "string" && desc.trim() ? desc : "—";
}

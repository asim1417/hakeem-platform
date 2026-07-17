import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/modules/auth/session";

export const dynamic = "force-dynamic";

export default async function AuditLogsPage() {
  await requirePagePermission("GOVERNANCE_AUDIT_VIEW");
  const logs = await prisma.auditEvent
    .findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        actor: {
          select: { name: true, email: true }
        }
      }
    })
    .catch(() => []);

  return (
    <AppShell>
      <p className="text-sm font-semibold text-[var(--gold-dark)]">الحوكمة والتدقيق</p>
      <h1 className="t-head mt-2 text-3xl font-bold text-[var(--navy)]">سجل التدقيق</h1>
      <p className="mt-2 text-sm text-[var(--ink-60)]">أحدث {logs.length.toLocaleString("ar-SA")} عملية مُسجَّلة في النظام.</p>

      <section className="mt-6 overflow-hidden rounded-[var(--r-xl)] border border-[var(--ink-08)] bg-ivory shadow-[var(--sh-xs)]">
        {logs.length === 0 ? (
          <div className="p-6 text-center text-[var(--ink-60)]">لا توجد سجلات تدقيق حتى الآن.</div>
        ) : (
          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full min-w-[760px] border-collapse text-right text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-[var(--ink-08)] bg-[var(--hakeem-bg-soft)] text-[var(--navy)] [&>th]:px-4 [&>th]:py-3 [&>th]:font-semibold">
                  <th scope="col">نوع العملية</th>
                  <th scope="col">الوحدة</th>
                  <th scope="col">الوصف</th>
                  <th scope="col">المستخدم</th>
                  <th scope="col">التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    className="border-b border-[var(--ink-04)] align-top transition odd:bg-ivory even:bg-[var(--hakeem-bg-soft)] hover:bg-[var(--gold-ghost)]"
                  >
                    <td className="px-4 py-3 font-mono-legal text-[var(--navy)]">{log.action}</td>
                    <td className="px-4 py-3 text-[var(--ink-70)]">{log.subject}</td>
                    <td className="px-4 py-3 text-[var(--ink-70)]">{describeLog(log.metadata)}</td>
                    <td className="px-4 py-3 text-[var(--ink-70)]">{log.actor?.name || log.actor?.email || "غير محدد"}</td>
                    <td className="px-4 py-3 font-mono-legal text-xs text-[var(--ink-60)]">{log.createdAt.toLocaleString("ar-SA")}</td>
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

function describeLog(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") return "لا يوجد وصف إضافي";

  const record = metadata as Record<string, unknown>;
  if (typeof record.description === "string") return record.description;
  if (typeof record.query === "string") return `بحث: ${record.query || "بدون عبارة بحث"}`;
  if (typeof record.requestId === "string") return `طلب ذكاء: ${record.requestId}`;
  if (typeof record.results === "number") return `عدد النتائج: ${record.results.toLocaleString("ar-SA")}`;

  return "تم تسجيل العملية بنجاح";
}

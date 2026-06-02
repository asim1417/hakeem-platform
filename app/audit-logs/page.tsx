import { AppShell } from "@/components/AppShell";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AuditLogsPage() {
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
      <p className="text-sm font-semibold text-gold">الحوكمة والتدقيق</p>
      <h1 className="mt-2 text-3xl font-bold text-olive">سجل التدقيق</h1>

      <section className="mt-6 overflow-hidden rounded-md border border-black/10 bg-white">
        {logs.length === 0 ? (
          <div className="p-5 text-gray-700">لا توجد سجلات تدقيق حتى الآن.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-right text-sm">
              <thead className="bg-sand text-olive">
                <tr>
                  <th className="px-4 py-3 font-bold">نوع العملية</th>
                  <th className="px-4 py-3 font-bold">الوحدة</th>
                  <th className="px-4 py-3 font-bold">الوصف</th>
                  <th className="px-4 py-3 font-bold">المستخدم</th>
                  <th className="px-4 py-3 font-bold">التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-t border-black/10 align-top">
                    <td className="px-4 py-3 text-olive">{log.action}</td>
                    <td className="px-4 py-3">{log.subject}</td>
                    <td className="px-4 py-3 text-gray-700">{describeLog(log.metadata)}</td>
                    <td className="px-4 py-3 text-gray-700">{log.actor?.name || log.actor?.email || "غير محدد"}</td>
                    <td className="px-4 py-3 text-gray-600">{log.createdAt.toLocaleString("ar-SA")}</td>
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

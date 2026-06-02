import { prisma } from "@/lib/prisma";
import { AppShell } from "@/components/AppShell";

export const dynamic = "force-dynamic";

export default async function AuditLogsPage() {
  const logs = await prisma.auditEvent
    .findMany({
      orderBy: { createdAt: "desc" },
      take: 25
    })
    .catch(() => []);

  return (
    <AppShell>
      <p className="text-sm font-semibold text-gold">الحوكمة والتدقيق</p>
      <h1 className="mt-2 text-3xl font-bold text-olive">سجل التدقيق</h1>
      <section className="mt-6 space-y-3">
        {logs.length === 0 ? (
          <div className="rounded-md bg-white p-5 text-gray-700">لا توجد سجلات تدقيق حتى الآن.</div>
        ) : null}
        {logs.map((log) => (
          <article key={log.id} className="rounded-md border border-black/10 bg-white p-4">
            <p className="text-sm text-gold">{log.subject} · {log.action}</p>
            <p className="mt-2 text-sm text-gray-600">{log.createdAt.toLocaleString("ar-SA")}</p>
          </article>
        ))}
      </section>
    </AppShell>
  );
}

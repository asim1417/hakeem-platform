import { SimulationWorkspace } from "@/components/SimulationWorkspace";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function SimulationsPage() {
  const [sessions, cases] = await Promise.all([
    prisma.simulation
      .findMany({
        orderBy: { updatedAt: "desc" },
        take: 10,
        include: {
          messages: { orderBy: { createdAt: "asc" } },
          decisions: { orderBy: { createdAt: "asc" } },
          judgments: { orderBy: { createdAt: "asc" } }
        }
      })
      .then((items) =>
        items.map((item) => ({
          id: item.id,
          title: item.title,
          stage: item.stage,
          createdAt: item.createdAt.toISOString(),
          messages: item.messages.map((message) => ({
            id: message.id,
            role: message.role,
            stage: message.stage,
            content: message.content,
            createdAt: message.createdAt.toISOString()
          })),
          decisions: item.decisions.map((decision) => ({
            id: decision.id,
            decisionType: decision.decisionType,
            content: decision.content,
            stage: decision.stage,
            createdAt: decision.createdAt.toISOString()
          })),
          judgments: item.judgments.map((judgment) => ({
            id: judgment.id,
            content: judgment.content,
            disclaimer: judgment.disclaimer,
            createdAt: judgment.createdAt.toISOString()
          }))
        }))
      )
      .catch(() => []),
    prisma.caseFile
      .findMany({
        orderBy: { updatedAt: "desc" },
        take: 25,
        select: { id: true, title: true }
      })
      .catch(() => [])
  ]);

  return (
    <div>
      <p className="text-sm font-semibold text-gold">محاكاة قضائية تدريبية</p>
      <h1 className="mt-2 text-3xl font-bold text-olive">المحاكاة</h1>
      <p className="mt-3 max-w-3xl leading-8 text-gray-700">
        أنشئ جلسة محاكاة قضائية تدريبية، وسجل مداخلات الأطراف والقرارات الإجرائية، ثم أصدر حكمًا تدريبيًا غير ملزم.
      </p>
      <div className="mt-6">
        <SimulationWorkspace initialSessions={sessions} cases={cases} />
      </div>
    </div>
  );
}

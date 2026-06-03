import { HakeemJudgeExperience } from "@/components/hakeem-original/HakeemJudgeExperience";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePagePermission } from "@/lib/modules/auth/session";

export const dynamic = "force-dynamic";

export default async function ModernSimulationsPage() {
  await requirePagePermission("SIMULATIONS_USE");
  const [sessions, cases, attachments] = await Promise.all([
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
      .catch(() => []),
    prisma.attachment
      .findMany({
        orderBy: { createdAt: "desc" },
        take: 25,
        select: { id: true, fileName: true, mimeType: true, createdAt: true }
      })
      .then((items) => items.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() })))
      .catch(() => [])
  ]);

  return (
    <div className="space-y-4">
      <div className="rounded-[var(--r-xl)] border border-[var(--gold-border)] bg-[var(--paper)] p-4 shadow-[var(--sh-xs)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="t-head text-sm font-semibold text-[var(--navy)]">الواجهة الحديثة التجريبية</p>
            <p className="mt-1 text-sm text-[var(--ink-60)]">
              هذه نسخة React المتصلة بقاعدة البيانات وواجهات التصدير. الواجهة الأساسية الآن هي نسخة حكيم الأصلية.
            </p>
          </div>
          <Link className="btn btn-gold" href="/dashboard/simulations">
            العودة إلى القاضي حكيم الأصلي
          </Link>
        </div>
      </div>
      <HakeemJudgeExperience initialSessions={sessions} cases={cases} attachments={attachments} />
    </div>
  );
}

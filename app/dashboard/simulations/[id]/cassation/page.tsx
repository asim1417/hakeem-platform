import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePagePermission } from "@/lib/modules/auth/session";
import { prisma } from "@/lib/prisma";
import { PostJudgmentRemedyForm } from "@/components/PostJudgmentRemedyForm";

export const dynamic = "force-dynamic";

export default async function SimulationCassationPage({ params }: { params: { id: string } }) {
  await requirePagePermission("SIMULATIONS_USE");
  const session = await prisma.simulation.findUnique({
    where: { id: params.id },
    include: { judgments: { orderBy: { createdAt: "asc" } } }
  });
  if (!session) notFound();
  const judgment = session.judgments.at(-1);

  return (
    <div className="space-y-6" dir="rtl">
      <section className="rounded-[var(--r-xl)] border border-[var(--gold-border)] bg-[linear-gradient(135deg,var(--navy),var(--navy-mid))] p-6 text-white shadow-[var(--sh-md)]">
        <p className="font-display-ar text-sm font-bold text-[var(--gold-pale)]">القاضي حكيم | مرحلة ما بعد الحكم</p>
        <h1 className="mt-2 font-judicial text-4xl font-bold">تقديم طلب نقض</h1>
        <p className="mt-3 text-sm leading-7 text-white/75">{session.title} | رقم الجلسة: {session.id}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link className="btn btn-gold" href="/dashboard/simulations">العودة إلى القاضي حكيم</Link>
          <Link className="btn ho-hero-outline" href={`/dashboard/simulations/${session.id}/appeal`}>الاستئناف</Link>
          <Link className="btn ho-hero-outline" href={`/dashboard/simulations/${session.id}/reconsideration`}>الالتماس</Link>
        </div>
      </section>

      {judgment ? (
        <section className="rounded-[var(--r-xl)] border border-[var(--ink-08)] bg-[var(--paper)] p-5">
          <h2 className="font-display-ar text-lg font-bold text-[var(--navy)]">بيانات الحكم محل النقض</h2>
          <p className="mt-3 line-clamp-5 rounded-[var(--r-lg)] bg-[var(--parchment)] p-4 font-judicial text-lg leading-9 text-[var(--ink)]">{judgment.content}</p>
        </section>
      ) : null}

      <PostJudgmentRemedyForm sessionId={session.id} remedyKind="cassation" disabled={!judgment} />
    </div>
  );
}

import Link from "next/link";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { findOwnedSimulation } from "@/lib/modules/auth/ownership";
import { requirePagePermission } from "@/lib/modules/auth/session";
import { PostJudgmentRemedyForm } from "@/components/PostJudgmentRemedyForm";

export const dynamic = "force-dynamic";

export default async function SimulationAppealPage({ params }: { params: { id: string } }) {
  const user = await requirePagePermission("SIMULATIONS_USE");
  const session = await findOwnedSimulation(user, params.id, {
    judgments: { orderBy: { createdAt: "asc" } }
  });
  if (!session) notFound();
  const judgment = session.judgments.at(-1);

  return (
    <PostJudgmentLayout
      title="تقديم لائحة استئناف"
      sessionId={session.id}
      sessionTitle={session.title}
      hasJudgment={Boolean(judgment)}
      judgmentContent={judgment?.content}
    >
      <PostJudgmentRemedyForm sessionId={session.id} remedyKind="appeal" disabled={!judgment} />
    </PostJudgmentLayout>
  );
}

function PostJudgmentLayout({
  title,
  sessionId,
  sessionTitle,
  hasJudgment,
  judgmentContent,
  children
}: {
  title: string;
  sessionId: string;
  sessionTitle: string;
  hasJudgment: boolean;
  judgmentContent?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-6" dir="rtl">
      <section className="rounded-[var(--r-xl)] border border-[var(--gold-border)] bg-[linear-gradient(135deg,var(--navy),var(--navy-mid))] p-6 text-white shadow-[var(--sh-md)]">
        <p className="font-display-ar text-sm font-bold text-[var(--gold-pale)]">القاضي حكيم | مرحلة ما بعد الحكم</p>
        <h1 className="mt-2 font-judicial text-4xl font-bold">{title}</h1>
        <p className="mt-3 text-sm leading-7 text-white/75">{sessionTitle}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link className="btn btn-gold" href="/dashboard/simulations">العودة إلى القاضي حكيم</Link>
          <Link className="btn ho-hero-outline" href={`/dashboard/simulations/${sessionId}/cassation`}>النقض</Link>
          <Link className="btn ho-hero-outline" href={`/dashboard/simulations/${sessionId}/reconsideration`}>الالتماس</Link>
          <Link className="btn ho-hero-outline" href="/dashboard/legal-core/objection-methods#appeal">الدليل الإجرائي</Link>
          <Link className="btn ho-hero-outline" href={`/api/simulations/${sessionId}/export?type=judgment&format=docx`}>تصدير الحكم DOCX</Link>
          <Link className="btn ho-hero-outline" href={`/api/simulations/${sessionId}/export?type=judgment&format=pdf`}>تصدير الحكم PDF</Link>
        </div>
      </section>

      {!hasJudgment ? (
        <div className="rounded-[var(--r-lg)] border border-dashed border-[var(--gold-border)] bg-[var(--gold-ghost)] p-5 text-center text-sm leading-7 text-[var(--navy)]">
          لا يمكن فتح مرحلة الاعتراض قبل صدور الحكم.
        </div>
      ) : null}

      {judgmentContent ? (
        <section className="rounded-[var(--r-xl)] border border-[var(--ink-08)] bg-[var(--paper)] p-5">
          <h2 className="font-display-ar text-lg font-bold text-[var(--navy)]">بيانات الحكم محل الاعتراض</h2>
          <p className="mt-3 line-clamp-5 rounded-[var(--r-lg)] bg-[var(--parchment)] p-4 font-judicial text-lg leading-9 text-[var(--ink)]">{judgmentContent}</p>
        </section>
      ) : null}

      {children}
    </div>
  );
}

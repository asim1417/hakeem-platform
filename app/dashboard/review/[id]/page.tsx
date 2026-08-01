import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePagePermission, getCurrentUser } from "@/lib/modules/auth/session";
import { getSession } from "@/lib/modules/review/service";
import { ReviewSessionClient } from "@/components/review/ReviewSessionClient";

export const dynamic = "force-dynamic";

/** تفاصيل جلسة المراجعة (§12) — ملاحظات واقتراحات بقرار بشريّ. */
export default async function ReviewSessionPage({ params }: { params: { id: string } }) {
  await requirePagePermission("REVIEW_USE");
  const user = await getCurrentUser().catch(() => null);
  if (!user) notFound();

  let session: Awaited<ReturnType<typeof getSession>> = null;
  try {
    session = await getSession(params.id, user.id);
  } catch {
    session = null;
  }
  if (!session) notFound();

  const findings = session.findings.map((f) => ({
    id: f.id,
    category: f.category,
    severity: f.severity,
    description: f.description,
    evidenceCount: Array.isArray(f.evidence) ? (f.evidence as unknown[]).length : 0,
    ruleId: f.ruleId,
  }));
  const suggestions = session.suggestions.map((s) => ({
    id: s.id,
    title: s.title,
    body: s.body,
    status: s.status,
    decisionNote: s.decisionNote,
  }));

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6" dir="rtl">
      <div className="mb-4">
        <Link href="/dashboard/review" className="text-sm text-[rgba(14,52,53,0.6)] hover:underline">
          ← مركز المراجعة
        </Link>
      </div>
      <header className="mb-5">
        <h1 className="text-2xl font-bold text-[#0E3435]">{session.title}</h1>
        <p className="mt-1 text-sm text-[rgba(14,52,53,0.6)]">
          النوع: {session.entityType} · الحالة: {session.status}
        </p>
      </header>
      <ReviewSessionClient sessionId={session.id} findings={findings} suggestions={suggestions} />
    </main>
  );
}

import Link from "next/link";
import { requirePagePermission, getCurrentUser } from "@/lib/modules/auth/session";
import { listSessions } from "@/lib/modules/review/service";
import { CreateReviewSession } from "@/components/review/CreateReviewSession";

export const dynamic = "force-dynamic";
export const metadata = { title: "مركز المراجعة — حكيم" };

const STATUS_LABEL: Record<string, string> = {
  OPEN: "مفتوحة",
  COMPLETED: "مكتملة",
  ARCHIVED: "مؤرشفة",
};

/** مركز المراجعة (§12): جلسات مراجعة قائمة على الدليل، اقتراحات بموافقة بشرية. */
export default async function ReviewCenterPage() {
  await requirePagePermission("REVIEW_USE");
  const user = await getCurrentUser().catch(() => null);

  let sessions: Awaited<ReturnType<typeof listSessions>> = [];
  let pending = false;
  try {
    if (user) sessions = await listSessions(user.id);
  } catch {
    pending = true; // قبل تطبيق الهجرة — لا تعطّل الصفحة.
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6" dir="rtl">
      <header className="mb-5">
        <h1 className="text-2xl font-bold text-[#0E3435]">مركز المراجعة</h1>
        <p className="mt-1 text-sm text-[rgba(14,52,53,0.7)]">
          مراجعةٌ منظّمة قائمة على الدليل — ملاحظات واقتراحات لا تُطبَّق إلا بقرارك (§12).
        </p>
      </header>

      <div className="mb-6">
        <CreateReviewSession />
      </div>

      {pending ? (
        <p className="rounded-md bg-[#FEF3C7] px-3 py-2 text-sm text-[#92400E]">
          جداول المراجعة قيد التهيئة. ستظهر جلساتك بعد تطبيق هجرة قاعدة البيانات.
        </p>
      ) : sessions.length === 0 ? (
        <p className="text-sm text-[rgba(14,52,53,0.6)]">لا توجد جلسات بعد — أنشئ أوّل جلسة أعلاه.</p>
      ) : (
        <ul className="space-y-2">
          {sessions.map((s) => (
            <li key={s.id}>
              <Link
                href={`/dashboard/review/${s.id}`}
                className="flex items-center justify-between rounded-xl border border-[rgba(14,52,53,0.1)] bg-white p-3 hover:bg-[#F7F2EA]"
              >
                <div>
                  <p className="font-semibold text-[#0E3435]">{s.title}</p>
                  <p className="text-xs text-[rgba(14,52,53,0.6)]">
                    {s.entityType} · ملاحظات {s._count.findings} · اقتراحات {s._count.suggestions}
                  </p>
                </div>
                <span className="rounded-full bg-[rgba(14,52,53,0.08)] px-2 py-0.5 text-xs text-[#0E3435]">
                  {STATUS_LABEL[s.status] ?? s.status}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

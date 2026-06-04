import Link from "next/link";

const remedies = [
  {
    key: "appeal",
    title: "الاستئناف",
    href: "appeal",
    description: "صياغة لائحة استئناف تدريبية على الحكم الصادر في المحاكاة.",
    scope: "يستخدم لمراجعة الوقائع والتسبيب وتطبيق النظام والطلبات."
  },
  {
    key: "cassation",
    title: "النقض",
    href: "cassation",
    description: "إعداد طلب نقض تدريبي يركز على مخالفة النظام والخطأ في تطبيقه.",
    scope: "يناسب أسباب مخالفة النظام، القصور في التسبيب، أو الاختصاص."
  },
  {
    key: "reconsideration",
    title: "التماس إعادة النظر",
    href: "reconsideration",
    description: "إعداد التماس إعادة نظر تدريبي وفق الأسباب الاستثنائية.",
    scope: "يناسب ظهور أوراق قاطعة، الغش أو التزوير، أو تناقض منطوق الحكم."
  }
];

export function PostJudgmentRemediesPanel({ sessionId, hasJudgment, compact = false }: { sessionId?: string; hasJudgment: boolean; compact?: boolean }) {
  if (!hasJudgment || !sessionId) {
    return (
      <section className="rounded-[var(--r-xl)] border border-dashed border-[var(--gold-border)] bg-[var(--gold-ghost)] p-5 text-sm leading-7 text-[var(--navy)]">
        لا يمكن فتح مرحلة الاعتراض قبل صدور الحكم.
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div>
        <p className="font-display-ar text-sm font-bold text-[var(--gold)]">بعد الحكم</p>
        <h2 className="mt-1 font-judicial text-3xl font-bold text-[var(--navy)]">مرحلة ما بعد الحكم</h2>
        {!compact ? (
          <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--ink-60)]">
            اختر مسار الاعتراض التدريبي المناسب. هذه النماذج تعليمية ولا تعد إجراءً قضائيًا فعليًا.
          </p>
        ) : null}
      </div>
      <div className="grid w-full max-w-full gap-4 md:grid-cols-3" dir="rtl">
        {remedies.map((remedy) => (
          <article key={remedy.key} className="flex min-w-0 flex-col rounded-[var(--r-xl)] border border-[var(--ink-08)] bg-[var(--paper)] p-5 shadow-[var(--sh-xs)]">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-display-ar text-lg font-bold text-[var(--navy)]">{remedy.title}</h3>
              <span className="rounded-full border border-[var(--gold-border)] bg-[var(--gold-ghost)] px-3 py-1 text-xs font-semibold text-[var(--navy)]">
                متاح
              </span>
            </div>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-70)]">{remedy.description}</p>
            <p className="mt-2 text-xs leading-6 text-[var(--ink-50)]">{remedy.scope}</p>
            <Link className="btn btn-gold mt-4 w-full justify-center" href={`/dashboard/simulations/${sessionId}/${remedy.href}`}>
              فتح النموذج
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}

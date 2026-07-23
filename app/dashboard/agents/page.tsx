import Link from "next/link";
import { requireUser } from "@/lib/modules/auth/session";
import { listManifests } from "@/lib/agent-runtime/live/manifests";

export const dynamic = "force-dynamic";

// كتالوج الوكلاء المتخصّصين — واجهةُ عرضٍ للمستخدم (بلا تفاصيل تقنيّة/أكواد). كلّ وكيلٍ مؤصَّلٌ
// بنطاقه النظاميّ، ويُبدأ بمحادثةٍ حيّة داخل صفحته.

/** أسماءٌ عربيّة لقدرات الوكيل (بدل معرّفات المحرّك الإنجليزيّة). */
const TOOL_LABEL: Record<string, string> = {
  legal_research: "البحث القانونيّ",
  read_article: "قراءة المادة",
  read_article_in_context: "قراءة المادة في سياقها",
  read_chapter: "قراءة الفصل",
  takhrij_hukm: "تخريج الحكم",
  trace_amendments: "تتبّع التعديلات",
  link_bylaw: "ربط اللائحة التنفيذيّة",
  build_citation: "صياغة الاستشهاد",
  exhaustive_scan: "المسح الشامل",
  hijri_date_calc: "حساب المهلة (هجريّ)",
};

/** أسماءٌ عربيّة للمواقف المهنيّة (بلا شُرَط سفليّة). */
const STANCE_LABEL: Record<string, string> = {
  "محايد": "محايد",
  "منازِع_دائن": "مُنازِع عن الدائن",
  "منازِع_مدين": "مُنازِع عن المدين",
  "خبير": "خبير",
  "مشرف": "مشرف",
};

export default async function AgentsPage() {
  await requireUser();
  const agents = listManifests();

  const roleLabel: Record<string, string> = {
    محامي_تقاضي_تجاري: "محامي تقاضٍ تجاريّ",
    ممارس_إفلاس: "ممارس إفلاس",
    معاون_قاضٍ: "معاون قاضٍ",
  };

  return (
    <div dir="rtl">
      <header className="hero">
        <p className="text-sm text-[var(--gold-pale)]">وكلاءُ حكيم المتخصّصون</p>
        <h1 className="t-display mt-2 text-3xl font-bold md:text-4xl">الوكلاء المتخصّصون</h1>
        <p className="mt-3 max-w-3xl leading-8 text-white/85">
          مستشارون متخصّصون، لكلٍّ منهم مجالُ خبرةٍ محدَّد ومكتبةٌ نظاميّة مؤصَّلة. يحلّلون وقائعك،
          ويستندون إلى المواد والأحكام الفعليّة، ويحاورونك في تخصّصهم عبر محادثةٍ حيّة داخل صفحة كلّ وكيل.
        </p>
      </header>

      <section className="mt-6 grid gap-4 xl:grid-cols-3">
        {agents.map((a) => {
          const engineTools = Array.from(new Set(a.skills.flatMap((s) => s.engineTools)));
          const approved = a.approval.status === "approved";
          return (
            <article key={a.agentId} className="rounded-[var(--r-xl)] border border-line bg-ivory p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg font-bold text-[var(--petrol)]">{a.displayName ?? a.agentId}</h2>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                    approved
                      ? "border border-[rgba(26,92,65,0.3)] bg-[var(--emerald-soft)] text-[var(--emerald)]"
                      : "border border-amber-300 bg-amber-50 text-amber-700"
                  }`}
                >
                  {approved ? "معتمَد ✓" : "قيد الاعتماد"}
                </span>
              </div>
              <p className="mt-1 text-sm text-[var(--muted)]">{roleLabel[a.practiceProfile.role] ?? a.practiceProfile.role}</p>

              <div className="mt-4">
                <p className="text-xs font-semibold text-[var(--ink-60)]">النطاق النظاميّ</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {a.scope.defaultSystems.map((s) => (
                    <span key={s} className="rounded-full bg-[var(--surface)] px-2.5 py-0.5 text-[11px] text-[var(--petrol)]">
                      {s.replace(/-/g, " ")}
                    </span>
                  ))}
                </div>
              </div>

              {a.subRoles?.length ? (
                <div className="mt-3">
                  <p className="text-xs font-semibold text-[var(--ink-60)]">الأدوار (المواقف)</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {a.subRoles.map((sr) => (
                      <span key={sr.subRoleId} className="rounded-full border border-line px-2.5 py-0.5 text-[11px] text-[var(--muted)]">
                        {sr.displayName ?? sr.subRoleId} · {STANCE_LABEL[sr.stance] ?? sr.stance.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mt-3">
                <p className="text-xs font-semibold text-[var(--ink-60)]">قدرات الوكيل</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {engineTools.map((t) => (
                    <span key={t} className="rounded-full bg-[var(--copper-soft)] px-2.5 py-0.5 text-[11px] text-[var(--copper-deep)]">
                      {TOOL_LABEL[t] ?? t}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-4">
                <Link
                  href={`/dashboard/agents/${a.agentId}`}
                  className="focus-ring inline-flex rounded-[var(--r-md)] bg-[var(--petrol)] px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90"
                >
                  ابدأ المحادثة مع الوكيل ←
                </Link>
              </div>
            </article>
          );
        })}
      </section>

      {/* قدرات تجريبية أخرى — مخفيّةٌ داخل المختبر (الرسم المعرفيّ · RAG · التدريب). */}
      <section className="mt-8">
        <Link href="/dashboard/lab" className="focus-ring inline-flex items-center gap-2 rounded-[var(--r-md)] border border-line bg-ivory px-4 py-2.5 text-sm font-semibold text-[var(--petrol)] transition hover:border-[var(--gold-border)]">
          🧪 المختبر التجريبيّ — قدرات قيد التطوير (الرسم المعرفيّ · الذكاء القانونيّ RAG · التدريب) ←
        </Link>
      </section>
    </div>
  );
}

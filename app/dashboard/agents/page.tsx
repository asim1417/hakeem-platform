import { requireUser } from "@/lib/modules/auth/session";
import { listManifests } from "@/lib/agent-runtime/live/manifests";
import { DeadlineCalculator } from "@/components/agents/DeadlineCalculator";

export const dynamic = "force-dynamic";

// كتالوج الوكلاء المخصّصين — طبقة تكوينٍ فوق المحرّك الموحّد. للعرض والاستكشاف؛
// الاستدعاء الفعليّ عبر مدخل MCP بمفتاح API. حاسبة المهلة أداةٌ حيّة مباشرة.
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
        <p className="text-sm text-[var(--gold-pale)]">طبقة الوكلاء</p>
        <h1 className="t-display mt-2 text-3xl font-bold md:text-4xl">الوكلاء المخصّصون</h1>
        <p className="mt-3 max-w-3xl leading-8 text-white/85">
          وكلاءُ ممارسةٍ مبنيّون طبقةَ تكوينٍ فوق المحرّك الموحّد — نطاقٌ مقيّد، ومهاراتٌ مصرّحة،
          وحرّاسٌ برمجيّة (تأريض · نطاق · نفاذ · موقف) تعمل على نتيجة النواة الفعليّة. يُستدعَون عبر مدخل MCP بمفتاح API.
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
                        {sr.displayName ?? sr.subRoleId} · {sr.stance}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mt-3">
                <p className="text-xs font-semibold text-[var(--ink-60)]">أدوات المحرّك</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {engineTools.map((t) => (
                    <span key={t} className="font-mono-legal rounded bg-[var(--copper-soft)] px-2 py-0.5 text-[11px] text-[var(--copper-deep)]">
                      {t}
                    </span>
                  ))}
                </div>
              </div>

              <p className="mt-4 font-mono-legal text-[11px] text-[var(--ink-40)]">/api/mcp/{a.agentId}</p>
            </article>
          );
        })}
      </section>

      <section className="mt-8">
        <h2 className="t-head mb-3 text-xl font-bold text-[var(--petrol)]">أداةٌ حيّة — حساب المهلة</h2>
        <DeadlineCalculator />
      </section>
    </div>
  );
}

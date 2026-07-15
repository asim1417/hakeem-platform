import Link from "next/link";

/**
 * شريط أدوات الذكاء القانوني الموحّد — يجمع أدوات «عقل حكيم» تحت تنقّل واحد
 * فلا تبدو صفحات متفرّقة لا رابط بينها. كل أداة تبقى صفحتها كما هي (لا دمج قسري):
 *   • تحليل القضية      → /dashboard/case-analysis
 *   • المحاكاة القضائية → /dashboard/judicial-simulation
 *   • الوكيل القانوني   → /dashboard/legal-agent
 * التوحيد في التجربة والتنقّل، مع الحفاظ على كل أداة تعمل.
 */
export type AiTool = "case-analysis" | "judicial-simulation" | "legal-agent";

const TOOLS: Array<{ tool: AiTool; href: string; label: string; hint: string }> = [
  { tool: "case-analysis", href: "/dashboard/case-analysis", label: "تحليل القضية", hint: "تحليل وقائع القضية واقتراح الدفوع" },
  { tool: "judicial-simulation", href: "/dashboard/judicial-simulation", label: "المحاكاة القضائية", hint: "محاكاة تفكير القاضي وتقدير المآل" },
  { tool: "legal-agent", href: "/dashboard/legal-agent", label: "الوكيل القانوني", hint: "بحث وكيل متعدّد الخطوات في القاعدة" },
];

export function AiToolTabs({ active }: { active: AiTool }) {
  return (
    <nav
      dir="rtl"
      aria-label="أدوات الذكاء القانوني"
      className="mt-4 inline-flex flex-wrap gap-1 rounded-[var(--r-lg)] border border-[var(--ink-08)] bg-[var(--ink-04)] p-1"
    >
      {TOOLS.map((t) => {
        const isActive = t.tool === active;
        return (
          <Link
            key={t.tool}
            href={t.href}
            aria-current={isActive ? "page" : undefined}
            title={t.hint}
            className={`rounded-[var(--r-md)] px-4 py-2 text-sm font-semibold transition ${
              isActive
                ? "bg-white text-[var(--navy)] shadow-[var(--sh-xs)]"
                : "text-[var(--ink-60)] hover:text-[var(--navy)]"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

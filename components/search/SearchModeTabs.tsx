import Link from "next/link";
import { TRADITIONAL_SEARCH_ENABLED } from "@/lib/modules/config/search-visibility";

/**
 * شريط أوضاع البحث الموحّد — يوحّد سطحَي البحث في اللوحة تحت مدخل واحد بوضعين،
 * فلا يتوه المستخدم بين صندوقين مختلفَي النتائج (جذر «الفرق بين الصناديق»):
 *   • «بحث شامل»  → /dashboard/legal-search (مواد + أحكام + مبادئ، أوجه، دلالي).
 *   • «بحث متقدّم» → /dashboard/legal-core/search (ضوابط صرفية: جذر/اشتقاق/جذع…).
 * كلا المحرّكين محفوظان (لا حذف ولا فقدان ميزة) — التوحيد في التجربة لا في الحذف.
 * يحافظ على عبارة البحث `q` عند التبديل بين الوضعين.
 */
export type SearchMode = "comprehensive" | "advanced";

const MODES: Array<{ mode: SearchMode; href: string; label: string; hint: string }> = [
  { mode: "comprehensive", href: "/dashboard/legal-search", label: "بحث شامل", hint: "مواد وأحكام ومبادئ مع أوجه وترتيب دلالي" },
  { mode: "advanced", href: "/dashboard/legal-core/search", label: "بحث متقدّم", hint: "ضوابط صرفية: جذر، اشتقاق، جذع، عبارة مطابقة" },
];

export function SearchModeTabs({ active, q = "" }: { active: SearchMode; q?: string }) {
  // البحث التقليديّ مخفيّ ⇒ لا يُعرَض شريط أوضاعه (كلا الوضعين تقليديّان).
  if (!TRADITIONAL_SEARCH_ENABLED) return null;
  const suffix = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
  return (
    <nav
      dir="rtl"
      aria-label="أوضاع البحث"
      className="inline-flex flex-wrap gap-1 rounded-[var(--r-lg)] border border-[var(--ink-08)] bg-[var(--ink-04)] p-1"
    >
      {MODES.map((m) => {
        const isActive = m.mode === active;
        return (
          <Link
            key={m.mode}
            href={`${m.href}${suffix}`}
            aria-current={isActive ? "page" : undefined}
            title={m.hint}
            className={`rounded-[var(--r-md)] px-4 py-2 text-sm font-semibold transition ${
              isActive
                ? "bg-ivory text-[var(--navy)] shadow-[var(--sh-xs)]"
                : "text-[var(--ink-60)] hover:text-[var(--navy)]"
            }`}
          >
            {m.label}
          </Link>
        );
      })}
    </nav>
  );
}

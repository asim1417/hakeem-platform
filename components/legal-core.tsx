import Link from "next/link";
import type { ReactNode } from "react";
import { BookOpen, Copy, Database, FileText, Filter, Scale, Search, ShieldCheck } from "lucide-react";

export function LegalCoreShell({ children }: { children: ReactNode }) {
  return <div className="min-h-screen rounded-[var(--r-2xl)] bg-[linear-gradient(180deg,var(--cream),var(--parchment))] text-[var(--ink)]">{children}</div>;
}

export function LegalCorePageHeader({
  eyebrow = "حكيم | النواة القانونية",
  title,
  description,
  actions
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <header className="relative overflow-hidden rounded-[var(--r-2xl)] border border-[rgba(192,155,90,.22)] bg-[linear-gradient(135deg,var(--navy),var(--navy-mid))] p-8 text-white shadow-[var(--sh-md)]">
      <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_20%_20%,rgba(212,175,110,.45),transparent_28%),linear-gradient(120deg,transparent,rgba(255,255,255,.06))]" />
      <div className="relative z-10 max-w-4xl">
        <p className="font-display-ar text-sm font-semibold tracking-wide text-[var(--gold-pale)]">{eyebrow}</p>
        <h1 className="mt-3 font-judicial text-5xl font-bold leading-tight">{title}</h1>
        <p className="mt-4 max-w-3xl text-base leading-8 text-white/78">{description}</p>
        {actions ? <div className="mt-6 flex flex-wrap gap-3">{actions}</div> : null}
      </div>
    </header>
  );
}

export function LegalCoreCard({ title, subtitle, children, icon }: { title?: string; subtitle?: string; children: ReactNode; icon?: ReactNode }) {
  return (
    <section className="rounded-[var(--r-xl)] border border-[var(--ink-08)] bg-[rgba(251,248,241,.92)] p-5 shadow-[var(--sh-xs)]">
      {title ? (
        <div className="mb-4 flex items-start gap-3">
          {icon ? <div className="grid h-10 w-10 place-items-center rounded-[var(--r-md)] bg-[var(--gold-ghost)] text-[var(--gold)]">{icon}</div> : null}
          <div>
            <h2 className="font-display-ar text-lg font-bold text-[var(--navy)]">{title}</h2>
            {subtitle ? <p className="mt-1 text-sm leading-6 text-[var(--ink-60)]">{subtitle}</p> : null}
          </div>
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function LegalCoreStatCard({ label, value, hint, tone = "navy" }: { label: string; value: number | string; hint?: string; tone?: "navy" | "emerald" | "amber" | "ruby" }) {
  const toneClass = {
    navy: "text-[var(--navy)]",
    emerald: "text-[var(--emerald)]",
    amber: "text-[var(--amber)]",
    ruby: "text-[var(--ruby)]"
  }[tone];
  return (
    <div className="rounded-[var(--r-lg)] border border-[var(--ink-08)] bg-[var(--paper)] p-5 shadow-[var(--sh-xs)]">
      <p className="font-display-ar text-xs font-semibold text-[var(--ink-60)]">{label}</p>
      <p className={`mt-3 font-judicial text-4xl font-bold leading-none ${toneClass}`}>{typeof value === "number" ? value.toLocaleString("ar-SA") : value}</p>
      {hint ? <p className="mt-3 text-xs leading-6 text-[var(--ink-60)]">{hint}</p> : null}
    </div>
  );
}

export function LegalCoreTable({ children }: { children: ReactNode }) {
  return <div className="overflow-hidden rounded-[var(--r-lg)] border border-[var(--ink-08)] bg-[var(--paper)]">{children}</div>;
}

export function LegalCoreSearchBar({ systems, defaultQuery, defaultSystem }: { systems: Array<{ lawName: string }>; defaultQuery?: string; defaultSystem?: string }) {
  return (
    <form action="/dashboard/legal-core/search" className="rounded-[var(--r-xl)] border border-[var(--gold-border)] bg-[var(--paper)] p-4 shadow-[var(--sh-xs)]">
      <div className="grid gap-3 lg:grid-cols-[1fr_260px_auto]">
        <label className="relative">
          <Search className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--gold)]" />
          <input
            name="q"
            defaultValue={defaultQuery}
            className="w-full rounded-[var(--r-md)] border border-[var(--ink-15)] bg-[var(--parchment)] py-3 pl-4 pr-12 leading-7 outline-none focus:border-[var(--gold)]"
            placeholder="ابحث في نص المادة أو رقمها أو موضوعها..."
          />
        </label>
        <select name="system" defaultValue={defaultSystem ?? ""} className="rounded-[var(--r-md)] border border-[var(--ink-15)] bg-[var(--parchment)] px-4 py-3 outline-none focus:border-[var(--gold)]">
          <option value="">كل الأنظمة</option>
          {systems.map((system) => (
            <option key={system.lawName} value={system.lawName}>
              {system.lawName}
            </option>
          ))}
        </select>
        <button className="btn btn-gold min-w-[140px]" type="submit">
          <Search size={16} />
          بحث قانوني
        </button>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        {["التصنيف", "الموضوع", "نوع المصدر", "يحتوي على شروح", "يحتوي على أحكام", "قانون مقارن"].map((filter) => (
          <div key={filter} className="rounded-[var(--r-md)] border border-[var(--ink-08)] bg-white/60 px-3 py-2 text-sm text-[var(--ink-60)]">
            <Filter className="ml-2 inline h-4 w-4 text-[var(--gold)]" />
            {filter}
          </div>
        ))}
      </div>
    </form>
  );
}

export function LegalCoreFilterPanel({ children }: { children: ReactNode }) {
  return (
    <aside className="rounded-[var(--r-xl)] border border-[var(--ink-08)] bg-[var(--paper)] p-5">
      <h2 className="font-display-ar text-base font-bold text-[var(--navy)]">مرشحات المعرفة</h2>
      <div className="mt-4 space-y-3">{children}</div>
    </aside>
  );
}

export function LegalSystemCard({ system }: { system: { lawName: string; classification: string | null; count: number } }) {
  return (
    <article className="rounded-[var(--r-xl)] border border-[var(--ink-08)] bg-[var(--paper)] p-5 shadow-[var(--sh-xs)] transition hover:border-[var(--gold-border)]">
      <div className="flex items-start justify-between gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-[var(--r-md)] bg-[var(--navy)] text-[var(--gold-pale)]">
          <BookOpen size={20} />
        </div>
        <LegalTopicBadge tone="emerald">ساري</LegalTopicBadge>
      </div>
      <h2 className="mt-4 font-display-ar text-lg font-bold leading-8 text-[var(--navy)]">{system.lawName}</h2>
      <p className="mt-2 text-sm text-[var(--ink-60)]">{system.classification ?? "تصنيف نظامي عام"}</p>
      <div className="mt-4 flex items-center justify-between border-t border-[var(--ink-08)] pt-4">
        <span className="font-mono-legal text-sm text-[var(--gold)]">{system.count.toLocaleString("ar-SA")} مادة</span>
        <span className="text-xs text-[var(--ink-40)]">تاريخ النفاذ: عند التوفر</span>
      </div>
      <div className="mt-4 flex gap-2">
        <Link href={`/dashboard/legal-core/search?system=${encodeURIComponent(system.lawName)}`} className="btn btn-primary flex-1">
          عرض المواد
        </Link>
        <button className="btn btn-outline" type="button">تحرير</button>
      </div>
    </article>
  );
}

export function LegalArticleCard({ article }: { article: { id: string; lawName: string; classification: string | null; articleNumber: number; title: string; content: string; chapter: string | null } }) {
  return (
    <article className="rounded-[var(--r-xl)] border border-[var(--ink-08)] bg-[var(--paper)] p-5 shadow-[var(--sh-xs)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono-legal text-sm text-[var(--gold)]">{article.lawName} | المادة {article.articleNumber.toLocaleString("ar-SA")}</p>
          <h2 className="mt-2 font-display-ar text-lg font-bold text-[var(--navy)]">{article.title}</h2>
          <p className="mt-1 text-xs text-[var(--ink-60)]">{[article.classification, article.chapter].filter(Boolean).join(" | ") || "غير مصنف تفصيليًا"}</p>
        </div>
        <LegalTopicBadge>مادة نظامية</LegalTopicBadge>
      </div>
      <p className="mt-4 line-clamp-4 font-judicial text-lg leading-9 text-[var(--ink)]">{article.content}</p>
      <div className="mt-5 flex flex-wrap gap-2">
        <Link className="btn btn-gold" href={`/dashboard/legal-core/articles/${article.id}`}>فتح المادة</Link>
        <Link className="btn btn-outline" href={`/dashboard/legal-core/articles/${article.id}#citation`}>نسخ الاستشهاد</Link>
      </div>
    </article>
  );
}

export function LegalTopicBadge({ children, tone = "gold" }: { children: ReactNode; tone?: "gold" | "emerald" | "amber" | "ruby" }) {
  const cls = {
    gold: "border-[var(--gold-border)] bg-[var(--gold-ghost)] text-[var(--navy)]",
    emerald: "border-[rgba(26,92,65,.25)] bg-[var(--emerald-soft)] text-[var(--emerald)]",
    amber: "border-[rgba(184,114,26,.25)] bg-[var(--amber-soft)] text-[var(--amber)]",
    ruby: "border-[rgba(140,34,51,.25)] bg-[var(--ruby-soft)] text-[var(--ruby)]"
  }[tone];
  return <span className={`inline-flex items-center rounded-full border px-3 py-1 font-display-ar text-xs font-semibold ${cls}`}>{children}</span>;
}

export function LegalCitationBlock({ lawName, articleNumber, content }: { lawName: string; articleNumber: number; content: string }) {
  return (
    <div id="citation" className="rounded-[var(--r-lg)] border border-[var(--gold-border)] bg-[var(--gold-ghost)] p-4">
      <div className="flex items-center gap-2 font-display-ar text-sm font-bold text-[var(--navy)]">
        <Copy size={16} className="text-[var(--gold)]" />
        صيغة الاستشهاد
      </div>
      <p className="mt-3 font-mono-legal text-sm leading-7 text-[var(--ink-80)]">{lawName}، المادة {articleNumber.toLocaleString("ar-SA")}: {content.slice(0, 220)}...</p>
    </div>
  );
}

export function ComparativeLawPanel() {
  return (
    <LegalCoreCard title="القانون المقارن" subtitle="مساحة منظمة للمقارنة عند إثراء المادة" icon={<Scale size={18} />}>
      <div className="grid gap-3">
        {[
          ["الدولة أو النظام المقارن", "لم يتم ربط مصدر مقارن بعد."],
          ["أوجه الشبه", "تضاف عند اعتماد المقارنة القانونية."],
          ["أوجه الاختلاف", "تضاف بعد المراجعة القانونية."],
          ["الفائدة العملية", "تحديد أثر المقارنة على الاستشارة أو المحاكاة."],
          ["المصدر", "غير محدد حاليًا."]
        ].map(([label, value]) => (
          <div key={label} className="rounded-[var(--r-md)] border border-[var(--ink-08)] bg-white/55 p-3">
            <p className="font-display-ar text-xs font-bold text-[var(--gold)]">{label}</p>
            <p className="mt-1 text-sm leading-7 text-[var(--ink-60)]">{value}</p>
          </div>
        ))}
      </div>
    </LegalCoreCard>
  );
}

export function ExplanationPanel() {
  return (
    <LegalCoreCard title="الشرح وشروط التطبيق" subtitle="لوحة شرح معرفية هادئة قابلة للإثراء" icon={<FileText size={18} />}>
      <div className="space-y-3 text-sm leading-8 text-[var(--ink-70)]">
        <p>لم يتم إدخال شرح معتمد لهذه المادة بعد. تظهر المادة كمصدر نظامي أصلي، ويمكن لاحقًا إضافة شرح، شروط تطبيق، آثار، واستثناءات مع مصدر مراجعة.</p>
        <LegalTopicBadge tone="amber">تحتاج إثراء معرفي</LegalTopicBadge>
      </div>
    </LegalCoreCard>
  );
}

export function RelatedMaterialsPanel({ articles }: { articles: Array<{ id: string; lawName: string; articleNumber: number; title: string }> }) {
  return (
    <LegalCoreCard title="المواد ذات العلاقة" subtitle="ترشيح أولي من نفس النظام أو التصنيف" icon={<Database size={18} />}>
      {articles.length ? (
        <div className="space-y-2">
          {articles.map((article) => (
            <Link key={article.id} href={`/dashboard/legal-core/articles/${article.id}`} className="block rounded-[var(--r-md)] border border-[var(--ink-08)] bg-white/60 p-3 hover:border-[var(--gold-border)]">
              <p className="font-mono-legal text-xs text-[var(--gold)]">{article.lawName} | المادة {article.articleNumber.toLocaleString("ar-SA")}</p>
              <p className="mt-1 font-display-ar text-sm font-bold text-[var(--navy)]">{article.title}</p>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-sm leading-7 text-[var(--ink-60)]">لا توجد مواد مترابطة معروضة حاليًا.</p>
      )}
    </LegalCoreCard>
  );
}

export function FiqhIssuesPanel({
  issues
}: {
  issues: Array<{ issueId: string; title: string; path: string; section: string; linkStatus: string; nizamRatio: number }>;
}) {
  return (
    <LegalCoreCard
      title="المسائل القانونية المرتبطة"
      subtitle="مسائل قانونية مربوطة بهذه المادة (قيد المراجعة)"
      icon={<Scale size={18} />}
    >
      {issues.length ? (
        <div className="space-y-2">
          {issues.map((issue) => (
            <div key={issue.issueId} className="rounded-[var(--r-md)] border border-[var(--ink-08)] bg-white/60 p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="font-display-ar text-sm font-bold text-[var(--navy)]">{issue.title}</p>
                <LegalTopicBadge tone={issue.linkStatus === "linked" ? "emerald" : "amber"}>
                  {issue.linkStatus === "linked" ? "مطابقة عالية" : "مراجعة"}
                </LegalTopicBadge>
              </div>
              <p className="mt-1 font-mono-legal text-[0.7rem] text-[var(--ink-60)]">{issue.path}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm leading-7 text-[var(--ink-60)]">لا توجد مسائل قانونية مرتبطة بهذه المادة حتى الآن.</p>
      )}
    </LegalCoreCard>
  );
}

export function QualityItem({ label, value, tone = "amber" }: { label: string; value: number; tone?: "emerald" | "amber" | "ruby" }) {
  return (
    <div className="flex items-center justify-between rounded-[var(--r-lg)] border border-[var(--ink-08)] bg-[var(--paper)] p-4">
      <div className="flex items-center gap-3">
        <ShieldCheck className={tone === "emerald" ? "text-[var(--emerald)]" : tone === "ruby" ? "text-[var(--ruby)]" : "text-[var(--amber)]"} size={19} />
        <span className="font-display-ar text-sm font-semibold text-[var(--navy)]">{label}</span>
      </div>
      <span className="font-mono-legal text-sm text-[var(--ink-60)]">{value.toLocaleString("ar-SA")}</span>
    </div>
  );
}

import Link from "next/link";
import type { ReactNode } from "react";
import { BookOpen, Copy, Database, ExternalLink, FileText, Filter, Fingerprint, History, Landmark, Scale, ScrollText, Search, ShieldCheck } from "lucide-react";
import { TRADITIONAL_SEARCH_ENABLED } from "@/lib/modules/config/search-visibility";
import { LegalCopyButton } from "@/components/LegalCopyButton";
import { buildArticleEli } from "@/lib/modules/legal-core/eli";
import { buildFiqhCitation } from "@/lib/modules/legal-core/content-separation";
import { getCoreSystemMeta, formatHijri } from "@/lib/modules/legal-core/core-systems";
import { reviewStatusLabel } from "@/lib/i18n/enum-labels";

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
  // نموذج البحث النصّيّ التقليديّ في النواة — يُخفى حين تُخفى واجهات البحث التقليديّ.
  if (!TRADITIONAL_SEARCH_ENABLED) return null;
  return (
    <form action="/dashboard/legal-core/search" className="rounded-[var(--r-xl)] border border-[var(--gold-border)] bg-[var(--paper)] p-4 shadow-[var(--sh-xs)]">
      <div className="grid gap-3 lg:grid-cols-[1fr_260px_auto]">
        <label className="relative">
          <Search className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--gold)]" />
          <input
            name="q" aria-label="بحث النواة القانونية"
            defaultValue={defaultQuery}
            className="w-full rounded-[var(--r-md)] border border-[var(--ink-15)] bg-[var(--parchment)] py-3 pl-4 pr-12 leading-7 outline-none focus:border-[var(--gold)]"
            placeholder="ابحث في نص المادة أو رقمها أو موضوعها..."
          />
        </label>
        <select name="system" aria-label="النظام" defaultValue={defaultSystem ?? ""} className="rounded-[var(--r-md)] border border-[var(--ink-15)] bg-[var(--parchment)] px-4 py-3 outline-none focus:border-[var(--gold)]">
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
          <div key={filter} className="rounded-[var(--r-md)] border border-[var(--ink-08)] bg-ivory/60 px-3 py-2 text-sm text-[var(--ink-60)]">
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

export function LegalSystemCard({ system }: { system: { id?: string | null; lawName: string; classification: string | null; count: number; code?: string | null; domainTitle?: string | null } }) {
  // الربط بالمعرّف الثابت (id) لا بالاسم النصّي الهشّ.
  const viewHref = system.id
    ? `/dashboard/legal-core/systems/${encodeURIComponent(system.id)}`
    : `/dashboard/legal-core/systems/${encodeURIComponent(system.lawName)}`;
  // تمييز الركائز الأحد‑عشر ببيانات رسمية مُتحقَّقة من بوابة العدل.
  const core = getCoreSystemMeta(system.lawName);
  const issuance = core ? formatHijri(core.issuanceDateH) : null;
  return (
    <article
      className={
        core
          ? "relative overflow-hidden rounded-[var(--r-xl)] border border-[var(--gold-border)] bg-[var(--paper)] p-5 shadow-[var(--sh-sm)] transition hover:shadow-[var(--sh-md)]"
          : "rounded-[var(--r-xl)] border border-[var(--ink-08)] bg-[var(--paper)] p-5 shadow-[var(--sh-xs)] transition hover:border-[var(--gold-border)]"
      }
    >
      {core ? <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-l from-[var(--gold)] to-[var(--gold-dark)]" aria-hidden /> : null}
      <div className="flex items-start justify-between gap-3">
        <div className={`grid h-11 w-11 place-items-center rounded-[var(--r-md)] ${core ? "bg-gradient-to-br from-[var(--navy)] to-[var(--gold-dark)]" : "bg-[var(--navy)]"} text-[var(--gold-pale)]`}>
          {core ? <Landmark size={20} /> : <BookOpen size={20} />}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {system.code ? <span className="font-mono-legal text-[11px] font-bold text-[var(--gold-dark)]" dir="ltr">{system.code}</span> : null}
          {core ? <LegalTopicBadge tone="gold">ركيزة أساسية</LegalTopicBadge> : null}
          <LegalTopicBadge tone="emerald">ساري</LegalTopicBadge>
        </div>
      </div>
      <h2 className="mt-4 font-display-ar text-lg font-bold leading-8 text-[var(--navy)]">{system.lawName}</h2>
      <p className="mt-2 text-sm text-[var(--ink-60)]">{core?.classification ?? system.domainTitle ?? system.classification ?? "تصنيف نظامي عام"}</p>
      <div className="mt-4 flex items-center justify-between border-t border-[var(--ink-08)] pt-4">
        <span className="font-mono-legal text-sm text-[var(--gold)]">{system.count.toLocaleString("ar-SA")} مادة</span>
        <span className="text-xs text-[var(--ink-40)]">{issuance ? `صدر: ${issuance}` : core?.sourceNote ?? "تاريخ النفاذ: عند التوفر"}</span>
      </div>
      {core && (core.regulationLawName || core.sourceUrl) ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-dashed border-[var(--gold-border)] pt-3 text-xs">
          {core.regulationLawName ? (
            <Link
              href={`/dashboard/legal-core/systems?q=${encodeURIComponent(core.regulationLawName)}`}
              className="inline-flex items-center gap-1 rounded-[var(--r-sm)] bg-[var(--gold-ghost)] px-2 py-1 font-medium text-[var(--gold-dark)] transition hover:bg-[var(--gold-pale)]"
            >
              <ScrollText size={13} />
              لائحته التنفيذية{core.regulationArticles ? ` (${core.regulationArticles.toLocaleString("ar-SA")} مادة)` : ""}
            </Link>
          ) : null}
          {core.sourceUrl ? (
            <a
              href={core.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[var(--ink-60)] transition hover:text-[var(--navy)]"
            >
              <ExternalLink size={13} />
              المصدر الرسمي
            </a>
          ) : null}
        </div>
      ) : null}
      <div className="mt-4 flex gap-2">
        <Link href={viewHref} className="btn btn-primary flex-1">
          عرض شجرة المواد
        </Link>
        {TRADITIONAL_SEARCH_ENABLED ? (
          <Link href={`/dashboard/legal-core/search?system=${encodeURIComponent(system.lawName)}`} className="btn btn-outline">
            بحث
          </Link>
        ) : null}
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

/** صيغة استناد رسمية موحّدة: النظام، المادة (رقم)، المرسوم الملكي + تاريخ النفاذ. */
export function buildOfficialCitation(input: {
  lawName: string;
  articleNumber: number;
  royalDecree?: string | null;
  effectiveFrom?: Date | string | null;
}): string {
  const parts = [`${input.lawName}، المادة (${input.articleNumber.toLocaleString("ar-SA")})`];
  if (input.royalDecree?.trim()) parts.push(`الصادر بالمرسوم الملكي رقم ${input.royalDecree.trim()}`);
  if (input.effectiveFrom) {
    const d = typeof input.effectiveFrom === "string" ? new Date(input.effectiveFrom) : input.effectiveFrom;
    if (!Number.isNaN(d.getTime())) parts.push(`تاريخ النفاذ ${d.toLocaleDateString("ar-SA")}`);
  }
  return parts.join("، ") + ".";
}

export function LegalCitationBlock({
  lawName,
  articleNumber,
  content,
  royalDecree,
  effectiveFrom,
  eliSlug
}: {
  lawName: string;
  articleNumber: number;
  content: string;
  royalDecree?: string | null;
  effectiveFrom?: Date | string | null;
  eliSlug?: string | null;
}) {
  const official = buildOfficialCitation({ lawName, articleNumber, royalDecree, effectiveFrom });
  const eli = buildArticleEli(lawName, articleNumber, eliSlug);
  return (
    <div id="citation" className="rounded-[var(--r-lg)] border border-[var(--gold-border)] bg-[var(--gold-ghost)] p-4">
      <div className="flex items-center gap-2 font-display-ar text-sm font-bold text-[var(--navy)]">
        <Copy size={16} className="text-[var(--gold)]" />
        صيغة الاستناد الرسمية
      </div>
      <p className="mt-3 font-mono-legal text-sm leading-7 text-[var(--navy)]">{official}</p>
      {royalDecree?.trim() ? null : (
        <p className="mt-2 text-[11px] text-[var(--amber)]">رقم المرسوم الملكي غير مُدخَل لهذه المادة بعد.</p>
      )}
      <div className="mt-3 border-t border-[var(--gold-border)] pt-3">
        <div className="flex items-center gap-2 font-display-ar text-xs font-bold text-[var(--navy)]">
          <Fingerprint size={14} className="text-[var(--gold)]" />
          المعرّف التشريعي الثابت (نمط ELI)
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Link href={eli.path} className="font-mono-legal text-xs leading-6 text-[var(--gold-dark)] underline-offset-2 hover:underline" dir="ltr">
            {eli.id}
          </Link>
          <LegalCopyButton text={eli.id} label="نسخ المعرّف" />
        </div>
      </div>
      <p className="mt-3 border-t border-[var(--gold-border)] pt-3 font-mono-legal text-xs leading-7 text-[var(--ink-60)]">
        نصّ مرجعي: {content.slice(0, 200)}…
      </p>
    </div>
  );
}

export type ArticleAmendmentView = {
  id: string;
  version: number;
  changeType: string;
  decreeRef: string | null;
  hijriDate: string | null;
  effectiveFrom: Date | string | null;
  summary: string | null;
  reviewStatus: string;
};

const CHANGE_TYPE_LABEL: Record<string, { label: string; tone: "emerald" | "amber" | "ruby" }> = {
  amended: { label: "تعديل", tone: "amber" },
  repealed: { label: "إلغاء", tone: "ruby" },
  reinstated: { label: "إعادة سريان", tone: "emerald" },
  corrected: { label: "تصحيح", tone: "amber" }
};

// سجلّ التعديلات والإصدارات التاريخية للمادة (حوكمة قانونية).
export function AmendmentsPanel({ amendments }: { amendments: ArticleAmendmentView[] }) {
  return (
    <LegalCoreCard title="التعديلات والإصدارات" subtitle="تتبّع التغييرات النظامية على المادة عبر الزمن" icon={<History size={18} />}>
      {amendments.length ? (
        <ol className="relative space-y-4 border-r border-[var(--gold-border)] pe-4">
          {amendments.map((a) => {
            const meta = CHANGE_TYPE_LABEL[a.changeType] ?? { label: a.changeType, tone: "amber" as const };
            const eff =
              a.effectiveFrom != null
                ? (typeof a.effectiveFrom === "string" ? new Date(a.effectiveFrom) : a.effectiveFrom)
                : null;
            return (
              <li key={a.id} className="relative rounded-[var(--r-md)] border border-[var(--ink-08)] bg-ivory/60 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono-legal text-xs text-[var(--gold)]">الإصدار {a.version.toLocaleString("ar-SA")}</span>
                  <div className="flex flex-wrap gap-2">
                    <LegalTopicBadge tone={meta.tone}>{meta.label}</LegalTopicBadge>
                    {a.reviewStatus !== "reviewed" ? <LegalTopicBadge tone="amber">{reviewStatusLabel(a.reviewStatus)}</LegalTopicBadge> : null}
                  </div>
                </div>
                {a.decreeRef ? <p className="mt-2 font-mono-legal text-xs text-[var(--navy)]">{a.decreeRef}</p> : null}
                {a.hijriDate || eff ? (
                  <p className="mt-1 text-xs text-[var(--ink-60)]">
                    {a.hijriDate ? `التاريخ الهجري: ${a.hijriDate}` : ""}
                    {a.hijriDate && eff ? " — " : ""}
                    {eff && !Number.isNaN(eff.getTime()) ? `النفاذ: ${eff.toLocaleDateString("ar-SA")}` : ""}
                  </p>
                ) : null}
                {a.summary ? <p className="mt-2 text-sm leading-7 text-[var(--ink-70)]">{a.summary}</p> : null}
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="rounded-[var(--r-md)] border border-dashed border-[var(--gold-border)] bg-[var(--gold-ghost)] p-4 text-center text-sm leading-7 text-[var(--navy)]">
          لا توجد تعديلات مسجّلة لهذه المادة. تُعدّ المادة سارية بنصّها الأصلي حتى يُوثَّق تعديل.
        </div>
      )}
    </LegalCoreCard>
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
          <div key={label} className="rounded-[var(--r-md)] border border-[var(--ink-08)] bg-ivory/55 p-3">
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
            <Link key={article.id} href={`/dashboard/legal-core/articles/${article.id}`} className="block rounded-[var(--r-md)] border border-[var(--ink-08)] bg-ivory/60 p-3 hover:border-[var(--gold-border)]">
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
      title="المسائل والتأصيل الفقهي المتوائم"
      subtitle="مواءمة موضوعية مساندة للفهم — ليست نصًا نظاميًا ولا مصدرًا ملزمًا"
      icon={<Scale size={18} />}
    >
      {issues.length ? (
        <div className="space-y-2">
          {issues.map((issue) => {
            const pct = Math.round(Math.max(0, Math.min(1, issue.nizamRatio || 0)) * 100);
            // وجه الصلة مشتقّ من موضع المسألة في شجرة المسائل.
            const relation = issue.section?.trim() || issue.path?.split("/").filter(Boolean).slice(-1)[0] || "صلة موضوعية عامة";
            const citation = buildFiqhCitation(issue.title, `المادة (${issue.path})`);
            return (
              <div key={issue.issueId} className="rounded-[var(--r-md)] border border-[var(--ink-08)] bg-ivory/60 p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-display-ar text-sm font-bold text-[var(--navy)]">{issue.title}</p>
                  <LegalTopicBadge tone={issue.linkStatus === "linked" ? "emerald" : "amber"}>
                    {issue.linkStatus === "linked" ? "مواءمة معتمدة" : "قيد المراجعة"}
                  </LegalTopicBadge>
                </div>
                <p className="mt-1.5 text-xs leading-6 text-[var(--ink-70)]">
                  <span className="font-semibold text-[var(--gold-dark)]">وجه الصلة:</span> {relation}
                </p>
                <p className="mt-1 font-mono-legal text-[0.7rem] text-[var(--ink-40)]">{issue.path}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[var(--gold-ghost)] px-2 py-0.5 text-[11px] font-semibold text-[var(--gold-dark)] tabular-nums">درجة التوافق {pct}%</span>
                  <LegalCopyButton text={citation} label="نسخ الإسناد (غير ملزم)" />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm leading-7 text-[var(--ink-60)]">لا توجد مواءمة فقهية مرتبطة بهذه المادة حتى الآن.</p>
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

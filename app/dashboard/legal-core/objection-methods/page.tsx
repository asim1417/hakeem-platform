import Link from "next/link";
import type { ReactNode } from "react";
import { CalendarClock, Gavel, ListChecks, Scale, ScrollText, ShieldCheck } from "lucide-react";
import { requirePagePermission } from "@/lib/modules/auth/session";
import { LegalCoreCard, LegalCorePageHeader, LegalCoreShell, LegalTopicBadge } from "@/components/legal-core";
import {
  appealNotes,
  appealOutcomeNotes,
  appealOutcomes,
  appealTypes,
  cassationGrounds,
  cassationMemo,
  cassationMemoNotes,
  cassationOutcomes,
  deadlines,
  generalConditions,
  governingPrinciples,
  memoNotes,
  memoRequirements,
  objectionReference,
  objectionRoutes,
  reconsiderationGrounds,
  reconsiderationJurisdiction,
  reconsiderationNotes,
  type ArticleNote,
  type RefTable
} from "@/lib/modules/legal-core/objection-methods";

export const dynamic = "force-dynamic";

const remedyLinks: Record<string, string> = {
  appeal: "/dashboard/simulations",
  cassation: "/dashboard/simulations",
  reconsideration: "/dashboard/simulations"
};

const sections = [
  { id: "overview", label: "نظرة عامة", icon: Scale },
  { id: "general", label: "الشروط العامة", icon: ListChecks },
  { id: "appeal", label: "الاستئناف", icon: Gavel },
  { id: "cassation", label: "النقض", icon: ScrollText },
  { id: "reconsideration", label: "التماس إعادة النظر", icon: ShieldCheck },
  { id: "deadlines", label: "المواعيد الإجرائية", icon: CalendarClock },
  { id: "principles", label: "المبادئ الحاكمة", icon: ShieldCheck }
];

export default async function ObjectionMethodsPage() {
  await requirePagePermission("LEGAL_CORE_VIEW");

  return (
    <LegalCoreShell>
      <div className="space-y-7" dir="rtl">
        <LegalCorePageHeader
          eyebrow="حكيم | النواة القانونية — دليل إجرائي"
          title={objectionReference.title}
          description={objectionReference.subtitle}
          actions={
            <>
              <Link href="/dashboard/legal-core" className="btn ho-hero-outline">
                <Scale size={16} /> النواة القانونية
              </Link>
              <Link href="/dashboard/simulations" className="btn btn-gold">
                <Gavel size={16} /> القاضي التفاعلي
              </Link>
            </>
          }
        />

        {/* فهرس المحتوى */}
        <nav className="rounded-[var(--r-xl)] border border-[var(--ink-08)] bg-[rgba(251,248,241,.92)] p-4 shadow-[var(--sh-xs)]">
          <p className="mb-3 font-display-ar text-sm font-bold text-[var(--navy)]">محتويات الدليل</p>
          <div className="flex flex-wrap gap-2">
            {sections.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--gold-border)] bg-white px-4 py-1.5 text-xs font-semibold text-[var(--navy)] transition hover:border-[var(--gold)] hover:shadow-[var(--sh-xs)]"
              >
                <s.icon size={14} className="text-[var(--gold)]" />
                {s.label}
              </a>
            ))}
          </div>
        </nav>

        {/* ١. نظرة عامة — الطرق الثلاثة */}
        <section id="overview" className="scroll-mt-24">
          <LegalCoreCard title="١. النظرة العامة — طرق الاعتراض الثلاثة" subtitle="تُتيح اللائحة التنفيذية ثلاثة طرق للاعتراض على الأحكام القضائية" icon={<Scale size={18} />}>
            <div className="grid gap-4 md:grid-cols-3">
              {objectionRoutes.map((route) => (
                <Link
                  key={route.key}
                  href={remedyLinks[route.key]}
                  className="group rounded-[var(--r-lg)] border border-[var(--ink-08)] bg-[var(--paper)] p-5 transition hover:border-[var(--gold-border)] hover:shadow-[var(--sh-sm)]"
                >
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-[var(--r-md)] bg-[var(--navy)] font-judicial text-lg text-[var(--gold-bright)]">
                      {route.badge}
                    </span>
                    <h3 className="font-display-ar text-lg font-bold text-[var(--navy)] group-hover:text-[var(--gold-dark,#9a7636)]">{route.name}</h3>
                  </div>
                  <dl className="mt-4 space-y-2 text-sm leading-6">
                    <Row label="الجهة الناظرة" value={route.court} />
                    <Row label="الأساس" value={route.basis} />
                    <Row label="المواد" value={route.articles} />
                  </dl>
                </Link>
              ))}
            </div>
          </LegalCoreCard>
        </section>

        {/* ١.١ + ١.٢ الشروط العامة ومذكرة الاعتراض */}
        <section id="general" className="scroll-mt-24 grid gap-5 xl:grid-cols-2">
          <LegalCoreCard title="١.١ الشروط العامة لجميع طرق الاعتراض" icon={<ListChecks size={18} />}>
            <NoteList notes={generalConditions} />
          </LegalCoreCard>
          <LegalCoreCard title="١.٢ شروط مذكرة الاعتراض — م/10" icon={<ScrollText size={18} />}>
            <ul className="space-y-2">
              {memoRequirements.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm leading-7 text-[var(--ink)]">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--gold)]" />
                  {item}
                </li>
              ))}
            </ul>
            <div className="mt-4 border-t border-[var(--ink-08)] pt-4">
              <NoteList notes={memoNotes} />
            </div>
          </LegalCoreCard>
        </section>

        {/* ٢. الاستئناف */}
        <section id="appeal" className="scroll-mt-24 space-y-5">
          <SectionHeading badge="①" title="٢. الاستئناف — م/19 إلى م/39" tone="emerald" />
          <div className="grid gap-5 xl:grid-cols-2">
            <LegalCoreCard title="٢.١ نوعا الاستئناف — م/19">
              <RefTableView table={appealTypes} />
            </LegalCoreCard>
            <LegalCoreCard title="أحكام ومسارات الاستئناف">
              <NoteList notes={appealNotes} />
            </LegalCoreCard>
          </div>
          <LegalCoreCard title="٢.٥ خيارات المنطوق" icon={<Gavel size={18} />}>
            <RefTableView table={appealOutcomes} />
            <div className="mt-4 border-t border-[var(--ink-08)] pt-4">
              <NoteList notes={appealOutcomeNotes} />
            </div>
          </LegalCoreCard>
        </section>

        {/* ٣. النقض */}
        <section id="cassation" className="scroll-mt-24 space-y-5">
          <SectionHeading badge="②" title="٣. النقض — م/40 إلى م/47" tone="amber" />
          <p className="text-sm leading-7 text-[var(--ink-60)]">
            طريق اعتراض أمام المحكمة العليا — يركز على المخالفات النظامية لا إعادة النظر في الوقائع.
          </p>
          <div className="grid gap-5 xl:grid-cols-2">
            <LegalCoreCard title="٣.١ أسباب النقض">
              <RefTableView table={cassationGrounds} />
            </LegalCoreCard>
            <LegalCoreCard title="٣.٢ متطلبات مذكرة النقض — م/42">
              <ul className="space-y-2">
                {cassationMemo.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm leading-7 text-[var(--ink)]">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--gold)]" />
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-4 border-t border-[var(--ink-08)] pt-4">
                <NoteList notes={cassationMemoNotes} />
              </div>
            </LegalCoreCard>
          </div>
          <LegalCoreCard title="٣.٤ خيارات المحكمة العليا" icon={<Gavel size={18} />}>
            <RefTableView table={cassationOutcomes} />
          </LegalCoreCard>
        </section>

        {/* ٤. التماس إعادة النظر */}
        <section id="reconsideration" className="scroll-mt-24 space-y-5">
          <SectionHeading badge="③" title="٤. التماس إعادة النظر — م/48 إلى م/59" tone="ruby" />
          <p className="text-sm leading-7 text-[var(--ink-60)]">طريق اعتراض غير عادي — مقيَّد بأسباب استثنائية حصرية.</p>
          <LegalCoreCard title="٤.١ الاختصاص — م/48">
            <p className="rounded-[var(--r-lg)] bg-[var(--gold-ghost)] p-4 text-sm leading-7 text-[var(--navy)]">{reconsiderationJurisdiction}</p>
          </LegalCoreCard>
          <LegalCoreCard title="٤.٢ أسباب الالتماس — م/200 نظام المرافعات">
            <RefTableView table={reconsiderationGrounds} />
          </LegalCoreCard>
          <LegalCoreCard title="إجراءات النظر ومرحلتاه">
            <NoteList notes={reconsiderationNotes} />
          </LegalCoreCard>
        </section>

        {/* ٥. المواعيد */}
        <section id="deadlines" className="scroll-mt-24">
          <LegalCoreCard title="٥. المواعيد الإجرائية الكاملة" subtitle="جدول مرجعي سريع للمدد النظامية" icon={<CalendarClock size={18} />}>
            <RefTableView table={deadlines} />
          </LegalCoreCard>
        </section>

        {/* ٦. المبادئ الحاكمة */}
        <section id="principles" className="scroll-mt-24">
          <LegalCoreCard title="٦. المبادئ الحاكمة في جميع طرق الاعتراض" icon={<ShieldCheck size={18} />}>
            <div className="grid gap-3 md:grid-cols-2">
              {governingPrinciples.map((note) => (
                <div key={note.article} className="rounded-[var(--r-md)] border border-[var(--ink-08)] bg-white/60 p-4">
                  <LegalTopicBadge tone="gold">{note.article}</LegalTopicBadge>
                  <p className="mt-2 text-sm leading-7 text-[var(--ink)]">{note.text}</p>
                </div>
              ))}
            </div>
          </LegalCoreCard>
        </section>

        <p className="pb-2 text-center text-xs text-[var(--ink-60)]">المصدر: {objectionReference.source}</p>
      </div>
    </LegalCoreShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-xs font-semibold text-[var(--ink-60)]">{label}</dt>
      <dd className="text-left font-semibold text-[var(--navy)]">{value}</dd>
    </div>
  );
}

function NoteList({ notes }: { notes: ArticleNote[] }) {
  return (
    <ul className="space-y-3">
      {notes.map((note) => (
        <li key={note.article} className="flex items-start gap-3 text-sm leading-7 text-[var(--ink)]">
          <span className="mt-0.5 inline-flex shrink-0 items-center rounded-full border border-[var(--gold-border)] bg-[var(--gold-ghost)] px-2.5 py-0.5 font-judicial text-xs font-bold text-[var(--gold-dark,#9a7636)]">
            {note.article}
          </span>
          <span>{note.text}</span>
        </li>
      ))}
    </ul>
  );
}

function RefTableView({ table }: { table: RefTable }) {
  const toneClass: Record<string, string> = {
    emerald: "bg-[var(--emerald-soft)]",
    amber: "bg-[rgba(184,114,26,0.08)]",
    ruby: "bg-[var(--ruby-soft)]",
    gold: "bg-[var(--gold-ghost)]"
  };
  return (
    <div className="overflow-x-auto rounded-[var(--r-lg)] border border-[var(--ink-08)]">
      <table className="w-full min-w-[420px] border-collapse text-right text-sm">
        <thead>
          <tr className="bg-[var(--navy)] text-white">
            {table.headers.map((h) => (
              <th key={h} className="px-3 py-2.5 font-display-ar text-xs font-bold first:rounded-tr-[var(--r-lg)] last:rounded-tl-[var(--r-lg)]">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, ri) => (
            <tr key={ri} className={`border-t border-[var(--ink-08)] ${row.tone ? toneClass[row.tone] : ri % 2 ? "bg-[var(--paper)]" : "bg-white/60"}`}>
              {row.cells.map((cell, ci) => (
                <td key={ci} className={`px-3 py-2.5 leading-6 ${ci === 0 ? "font-semibold text-[var(--navy)]" : "text-[var(--ink)]"}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SectionHeading({ badge, title, tone }: { badge: string; title: string; tone: "emerald" | "amber" | "ruby" }) {
  const toneBg: Record<string, string> = {
    emerald: "bg-[var(--emerald)]",
    amber: "bg-[var(--amber)]",
    ruby: "bg-[var(--ruby)]"
  };
  return (
    <div className="flex items-center gap-3">
      <span className={`grid h-11 w-11 place-items-center rounded-[var(--r-md)] font-judicial text-xl text-white ${toneBg[tone]}`}>{badge}</span>
      <h2 className="font-judicial text-2xl font-bold text-[var(--navy)]">{title}</h2>
    </div>
  );
}

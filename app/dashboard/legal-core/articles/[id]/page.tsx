import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen, FileText, Link2, Pencil, Scale, ChevronRight, ChevronLeft, ShieldAlert, ScrollText } from "lucide-react";
import { getCurrentUser, requirePagePermission } from "@/lib/modules/auth/session";
import { awardReadArticle } from "@/lib/modules/credits/engagement";
import { prisma } from "@/lib/prisma";
import { LegalCopyButton } from "@/components/LegalCopyButton";
import { HighlightedSearchText, countSearchMatches, joinSearchTerms } from "@/components/SearchHighlight";
import { ArticleReadingTools } from "@/components/ArticleReadingTools";
import { ArticleTabs, type ArticleTab } from "@/components/ArticleTabs";
import {
  AmendmentsPanel,
  ComparativeLawPanel,
  ExplanationPanel,
  FiqhIssuesPanel,
  LegalCitationBlock,
  LegalCoreCard,
  LegalCorePageHeader,
  LegalCoreShell,
  LegalTopicBadge,
  RelatedMaterialsPanel,
  buildOfficialCitation
} from "@/components/legal-core";
import { getFiqhIssuesForArticle } from "@/lib/modules/legal-core/fiqh-issues";
import { extractArticleReferences } from "@/lib/modules/legal-core/cross-references";
import { resolveArticleIds } from "@/lib/modules/library/library-service";
import { getGraphNeighbors } from "@/lib/modules/knowledge-graph/relations";
import { sanitizeDisplayText } from "@/lib/modules/legal-core/display-text";
import type { RelationType } from "@prisma/client";
import { FIQH_NONBINDING_NOTICE } from "@/lib/modules/legal-core/content-separation";
import { reviewStatusLabel } from "@/lib/i18n/enum-labels";

export const dynamic = "force-dynamic";

// لون حالة المادة: ساري=أخضر، ملغى=عقيق، معدّل=كهرماني.
function statusTone(status?: string | null): "emerald" | "amber" | "ruby" {
  const s = (status ?? "").trim();
  if (s.includes("ملغ") || s.includes("منسوخ") || s.includes("موقوف")) return "ruby";
  if (s.includes("معدّل") || s.includes("معدل") || s.includes("مؤقت")) return "amber";
  return "emerald";
}

// تسمية عربية لنوع العلاقة في الرسم المعرفي.
const RELATION_LABELS: Record<RelationType, string> = {
  SUPPORTS: "يدعم",
  CONTRADICTS: "يعارض",
  INTERPRETS: "يفسّر",
  IMPLEMENTS: "ينفّذ",
  SUPERSEDES: "يَنسخ",
  RELATED_TO: "متعلّق"
};
function relationLabel(r: RelationType): string {
  return RELATION_LABELS[r] ?? "متعلّق";
}

function Placeholder({ note }: { note: string }) {
  return (
    <div className="rounded-[var(--r-lg)] border border-dashed border-[var(--gold-border)] bg-[var(--gold-ghost)] p-5 text-sm leading-7 text-[var(--navy)]">
      {note} يبقى نصّ المادة هو المصدر النظامي الأصلي.
    </div>
  );
}

export default async function LegalCoreArticlePage({ params, searchParams }: { params: { id: string }; searchParams?: { q?: string } }) {
  await requirePagePermission("LEGAL_CORE_VIEW");

  const article = await prisma.legalArticle
    .findUnique({
      where: { id: params.id },
      include: {
        legalSystem: { select: { id: true, name: true, code: true, eliSlug: true } },
        caseLinks: {
          include: {
            judicialCase: {
              select: { id: true, judgmentTitle: true, caseNo: true, decisionNo: true, court: true, cityName: true, decisionDateText: true }
            }
          },
          orderBy: { createdAt: "desc" },
          take: 8
        },
        // العدّ الحقيقي للأحكام المستشهِدة (للشارة)، بينما تُعرض أحدث 8 فقط أعلاه.
        _count: { select: { caseLinks: true } },
        amendments: {
          orderBy: { version: "asc" },
          select: { id: true, version: true, changeType: true, decreeRef: true, hijriDate: true, effectiveFrom: true, summary: true, reviewStatus: true }
        }
      }
    })
    .catch(() => null);

  if (!article) notFound();

  // حافز قراءة مادة — مرة واحدة لكل مادة (سقوط آمن).
  const reader = await getCurrentUser().catch(() => null);
  if (reader) void awardReadArticle(reader.id, article.id).catch(() => undefined);

  // التنقّل بين مواد النظام نفسه (السابقة/اللاحقة).
  const [related, prevArticle, nextArticle] = await Promise.all([
    prisma.legalArticle.findMany({
      where: {
        id: { not: article.id },
        OR: [{ lawName: article.lawName }, article.classification ? { classification: article.classification } : { lawName: article.lawName }]
      },
      orderBy: [{ lawName: "asc" }, { articleNumber: "asc" }],
      take: 6,
      select: { id: true, lawName: true, articleNumber: true, title: true }
    }),
    prisma.legalArticle.findFirst({
      where: { lawName: article.lawName, articleNumber: { lt: article.articleNumber } },
      orderBy: { articleNumber: "desc" },
      select: { id: true, articleNumber: true }
    }),
    prisma.legalArticle.findFirst({
      where: { lawName: article.lawName, articleNumber: { gt: article.articleNumber } },
      orderBy: { articleNumber: "asc" },
      select: { id: true, articleNumber: true }
    })
  ]);

  const query = (searchParams?.q ?? "").trim();
  const highlightTerms = joinSearchTerms(query);
  // نصّ العرض المنقّى (غير مُتلِف للكلمات): يُزيل المحارف الفاسدة ويحفظ بنية الأسطر.
  const content = sanitizeDisplayText(article.content);
  const matches = countSearchMatches(content, highlightTerms);
  const fiqhIssues = getFiqhIssuesForArticle(article.lawName, article.articleNumber, 8);
  const officialCitation = buildOfficialCitation({ lawName: article.lawName, articleNumber: article.articleNumber, royalDecree: article.royalDecree, effectiveFrom: article.effectiveFrom });

  // الإحالات الداخلية: مواد يشير إليها نصّ هذه المادة داخل النظام نفسه.
  const refs = extractArticleReferences(content, article.articleNumber).slice(0, 12);
  const refIds = refs.length
    ? await resolveArticleIds(refs.map((r) => ({ lawName: article.lawName, articleNumber: r.articleNumber }))).catch(() => new Map<string, string>())
    : new Map<string, string>();
  const crossReferences = refs.map((r) => ({ ...r, id: refIds.get(`${article.lawName}|${r.articleNumber}`) ?? null }));

  // مواد ذات صلة عبر الرسم المعرفي (روابط منظّمة، لا مجرّد تطابق تصنيف). نأخذ الجيران من نوع
  // «مادة» فقط (الأحكام تظهر في تبويبها) مرتّبةً بالقوّة. سقوط آمن إلى [] إن غاب الرسم/فشل.
  const graphArticleNeighbors = (await getGraphNeighbors("article", article.id, 24))
    .filter((n) => n.entity.type === "article")
    .slice(0, 8);

  // محتوى الأحكام المرتبطة (يُعرض داخل تبويب). العدّ الحقيقي قد يفوق المعروض (أحدث 8).
  const citingCount = article._count.caseLinks;
  const judgmentsNode = article.caseLinks.length ? (
    <div className="space-y-3">
      {citingCount > article.caseLinks.length ? (
        <p className="text-xs text-[var(--ink-60)]">
          مُستشهَد بهذه المادة في {citingCount.toLocaleString("ar-SA")} حكمًا — تُعرض أحدث {article.caseLinks.length.toLocaleString("ar-SA")}.
        </p>
      ) : null}
      {article.caseLinks.map((link) => (
        <article key={link.id} className="rounded-[var(--r-lg)] border border-[var(--ink-08)] bg-ivory/60 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-mono-legal text-sm text-[var(--gold)]">
                {link.judicialCase.caseNo ? `قضية ${link.judicialCase.caseNo}` : "قضية غير مرقمة"}
                {link.judicialCase.decisionNo ? ` | قرار ${link.judicialCase.decisionNo}` : ""}
              </p>
              <h3 className="mt-1 font-display-ar text-base font-bold text-[var(--navy)]">{link.judicialCase.judgmentTitle ?? "حكم قضائي مستورد"}</h3>
              <p className="mt-1 text-xs text-[var(--ink-60)]">
                {[link.judicialCase.court, link.judicialCase.cityName, link.judicialCase.decisionDateText].filter(Boolean).join(" | ") || "بيانات الحكم غير مكتملة"}
              </p>
            </div>
            <LegalTopicBadge tone={link.reviewStatus === "reviewed" ? "emerald" : "amber"}>{reviewStatusLabel(link.reviewStatus)}</LegalTopicBadge>
          </div>
          {link.excerpt ? <p className="mt-3 rounded-[var(--r-md)] bg-[var(--gold-ghost)] p-3 text-sm leading-7 text-[var(--ink-70)]">{link.excerpt}</p> : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <Link className="btn btn-gold" href={`/dashboard/legal-core/judgments/${link.judicialCase.id}`}>فتح الحكم</Link>
            <LegalCopyButton text={`${article.lawName}، المادة ${article.articleNumber}: ${link.citedText ?? ""}`} label="نسخ الاستشهاد" />
          </div>
        </article>
      ))}
    </div>
  ) : (
    <Placeholder note="لا توجد أحكام أو استشهادات معتمدة مرتبطة بهذه المادة حتى الآن." />
  );

  // التبويبات المنظّمة (الفصل البصري الصارم: الفقه طبقة مساندة غير ملزمة).
  const tabs: ArticleTab[] = [
    { id: "explanation", label: "الشرح والتحليل", content: <ExplanationPanel /> },
    { id: "judgments", label: "الأحكام والمبادئ", badge: citingCount, content: judgmentsNode },
    { id: "regulation", label: "اللائحة التنفيذية", content: <Placeholder note="لم تُربط لائحة تنفيذية معتمدة بهذه المادة بعد." /> },
    {
      id: "fiqh",
      label: "النصوص الفقهية المتوائمة",
      badge: fiqhIssues.length,
      content: (
        <div className="space-y-3">
          <div className="flex items-start gap-2 rounded-[var(--r-lg)] border border-[var(--amber)]/40 bg-[var(--amber-soft)] p-3 text-sm leading-7 text-[var(--navy)]">
            <ShieldAlert size={18} className="mt-0.5 shrink-0 text-[var(--amber)]" aria-hidden />
            <p>{FIQH_NONBINDING_NOTICE}</p>
          </div>
          <FiqhIssuesPanel issues={fiqhIssues} />
        </div>
      )
    },
    { id: "questions", label: "الأسئلة العملية", content: <Placeholder note="لم تُضَف أسئلة عملية معتمدة لهذه المادة بعد." /> },
    { id: "subissues", label: "المسائل المتفرعة", content: <Placeholder note="لم تُربط مسائل متفرعة معتمدة بهذه المادة بعد." /> },
    { id: "comparative", label: "القانون المقارن", content: <ComparativeLawPanel /> },
    { id: "references", label: "المراجع", content: <Placeholder note="لم تُسجَّل مراجع معتمدة لهذه المادة بعد." /> },
    { id: "history", label: "سجل التعديلات", badge: article.amendments.length, content: <AmendmentsPanel amendments={article.amendments} /> }
  ];

  return (
    <LegalCoreShell>
      <div className="space-y-7" id="legal-reading-root">
        <LegalCorePageHeader
          title={`المادة ${article.articleNumber.toLocaleString("ar-SA")}`}
          description={`${article.lawName}${article.chapter ? ` | ${article.chapter}` : ""}`}
          actions={
            <div className="reading-hideable flex flex-wrap items-center gap-2">
              <LegalCopyButton text={content} label="نسخ نص المادة" />
              <LegalCopyButton text={officialCitation} label="نسخ الإحالة" />
              <button className="btn btn-outline opacity-50 cursor-not-allowed" type="button" disabled title="قريبًا — قيد التطوير"><Pencil size={16} /> تحرير</button>
              <Link className="btn btn-gold" href={`/dashboard/simulations?article=${article.id}`}><Scale size={16} /> استخدام في القاضي حكيم</Link>
              <Link className="btn ho-hero-outline" href={`/dashboard/consultations?article=${article.id}`}><FileText size={16} /> استخدام في الاستشارة</Link>
            </div>
          }
        />

        <section className="grid gap-5 xl:grid-cols-[1fr_360px]">
          <div className="space-y-5">
            {/* صندوق النص النظامي الرسمي — مفصول بصريًا وبعنوان صريح */}
            <article className="article-print-box rounded-[var(--r-2xl)] border-2 border-[var(--gold-border)] bg-[var(--parchment)] p-8 shadow-[var(--sh-md)]">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--navy)] px-3 py-1 text-xs font-bold text-[var(--gold-pale)]">
                  <ScrollText size={14} aria-hidden /> النص النظامي الرسمي
                </span>
                <ArticleReadingTools exportText={content} exportTitle={`${article.lawName} — المادة ${article.articleNumber}`} citation={officialCitation} />
              </div>
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--gold-border)] pb-5">
                <div>
                  <p className="font-mono-legal text-sm text-[var(--gold)]">{article.lawName}</p>
                  <h2 className="mt-2 font-judicial text-4xl font-bold text-[var(--navy)]">المادة {article.articleNumber.toLocaleString("ar-SA")}</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  <LegalTopicBadge tone={statusTone(article.status)}>{article.status || "سارية"}</LegalTopicBadge>
                  {article.classification ? <LegalTopicBadge>{article.classification}</LegalTopicBadge> : null}
                </div>
              </div>
              {article.chapter ? <p className="mb-4 font-display-ar text-sm font-semibold text-[var(--ink-60)]">{article.chapter}</p> : null}
              {query ? (
                <div className="reading-hideable mb-5 rounded-[var(--r-lg)] border border-[var(--gold-border)] bg-[var(--gold-ghost)] p-4">
                  <p className="font-display-ar text-sm font-bold text-[var(--navy)]">عدد المطابقات داخل المادة: {matches.toLocaleString("ar-SA")}</p>
                </div>
              ) : null}
              <p className="article-body font-judicial text-[var(--ink)]">
                <HighlightedSearchText text={content} terms={highlightTerms} anchorPrefix="match" />
              </p>
            </article>

            {/* التنقّل بين مواد النظام */}
            <nav className="reading-hideable flex items-center justify-between gap-3" aria-label="التنقّل بين المواد">
              {prevArticle ? (
                <Link className="btn btn-outline" href={`/dashboard/legal-core/articles/${prevArticle.id}`}>
                  <ChevronRight size={16} /> المادة {prevArticle.articleNumber.toLocaleString("ar-SA")}
                </Link>
              ) : <span />}
              {nextArticle ? (
                <Link className="btn btn-outline" href={`/dashboard/legal-core/articles/${nextArticle.id}`}>
                  المادة {nextArticle.articleNumber.toLocaleString("ar-SA")} <ChevronLeft size={16} />
                </Link>
              ) : <span />}
            </nav>

            {/* الأقسام المنظّمة في تبويبات (شرح/أحكام/فقه/سجل…) */}
            <div className="reading-hideable">
              <ArticleTabs tabs={tabs} />
            </div>
          </div>

          <aside className="reading-hideable space-y-5">
            <LegalCoreCard title="رأس المادة" subtitle="بيانات تعريفية سريعة" icon={<BookOpen size={18} />}>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between gap-3"><dt className="text-[var(--ink-60)]">النظام</dt><dd className="text-left font-semibold text-[var(--navy)]">{article.lawName}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-[var(--ink-60)]">رقم المادة</dt><dd className="font-mono-legal text-[var(--gold)]">{article.articleNumber.toLocaleString("ar-SA")}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-[var(--ink-60)]">التصنيف</dt><dd>{article.classification ?? "غير محدد"}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-[var(--ink-60)]">المرسوم الملكي</dt><dd className="text-left font-mono-legal text-[var(--gold)]">{article.royalDecree?.trim() || "غير مُدخَل"}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-[var(--ink-60)]">تاريخ النفاذ</dt><dd>{article.effectiveFrom ? article.effectiveFrom.toLocaleDateString("ar-SA") : "غير مدخل"}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-[var(--ink-60)]">الحالة</dt><dd><LegalTopicBadge tone={statusTone(article.status)}>{article.status || "سارية"}</LegalTopicBadge></dd></div>
              </dl>
              <div className="mt-4 flex flex-wrap gap-2">
                <button className="btn btn-outline opacity-50 cursor-not-allowed" type="button" disabled title="قريبًا — قيد التطوير"><Link2 size={16} /> ربط بمسألة</button>
                <button className="btn btn-outline opacity-50 cursor-not-allowed" type="button" disabled title="قريبًا — قيد التطوير"><Scale size={16} /> ربط بحكم</button>
              </div>
            </LegalCoreCard>

            <LegalCitationBlock lawName={article.lawName} articleNumber={article.articleNumber} content={content} royalDecree={article.royalDecree} effectiveFrom={article.effectiveFrom} eliSlug={article.legalSystem?.eliSlug} />

            {crossReferences.length ? (
              <LegalCoreCard title="المواد المُحال إليها" subtitle="إحالات داخلية مستخرَجة من نصّ المادة" icon={<Link2 size={18} />}>
                <div className="flex flex-wrap gap-2">
                  {crossReferences.map((r) =>
                    r.id ? (
                      <Link key={r.articleNumber} href={`/dashboard/legal-core/articles/${r.id}`} className="inline-flex items-center gap-1 rounded-[var(--r-md)] border border-[var(--gold-border)] bg-[var(--gold-ghost)] px-2.5 py-1 text-xs font-semibold text-[var(--navy)] transition hover:border-[var(--gold)]">
                        المادة {r.articleNumber.toLocaleString("ar-SA")}
                      </Link>
                    ) : (
                      <span key={r.articleNumber} className="inline-flex items-center gap-1 rounded-[var(--r-md)] border border-[var(--ink-08)] bg-ivory/60 px-2.5 py-1 text-xs text-[var(--ink-60)]">
                        المادة {r.articleNumber.toLocaleString("ar-SA")}
                      </span>
                    )
                  )}
                </div>
              </LegalCoreCard>
            ) : null}

            <RelatedMaterialsPanel articles={related} />

            {graphArticleNeighbors.length ? (
              <LegalCoreCard title="مواد ذات صلة (الرسم المعرفي)" subtitle="روابط مُشتقّة من الرسم المعرفي القانوني — أقوى الصلات أولًا" icon={<Link2 size={18} />}>
                <ul className="space-y-2">
                  {graphArticleNeighbors.map((n) => (
                    <li key={n.relationId}>
                      <Link
                        href={`/dashboard/legal-core/articles/${n.entity.id}`}
                        className="flex items-start justify-between gap-2 rounded-[var(--r-md)] border border-[var(--ink-08)] bg-ivory/60 px-3 py-2 text-xs leading-6 text-[var(--navy)] transition hover:border-[var(--gold)]"
                      >
                        <span className="font-semibold">{n.entity.label}</span>
                        <LegalTopicBadge tone="amber">{relationLabel(n.relation)}</LegalTopicBadge>
                      </Link>
                    </li>
                  ))}
                </ul>
              </LegalCoreCard>
            ) : null}
          </aside>
        </section>
      </div>
    </LegalCoreShell>
  );
}

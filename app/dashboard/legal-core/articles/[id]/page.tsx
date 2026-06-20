import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen, FileText, Link2, Pencil, Scale } from "lucide-react";
import { requirePagePermission } from "@/lib/modules/auth/session";
import { prisma } from "@/lib/prisma";
import { LegalCopyButton } from "@/components/LegalCopyButton";
import { HighlightedSearchText, countSearchMatches, joinSearchTerms } from "@/components/SearchHighlight";
import {
  ComparativeLawPanel,
  ExplanationPanel,
  FiqhIssuesPanel,
  LegalCitationBlock,
  LegalCoreCard,
  LegalCorePageHeader,
  LegalCoreShell,
  LegalTopicBadge,
  RelatedMaterialsPanel
} from "@/components/legal-core";
import { getFiqhIssuesForArticle } from "@/lib/modules/legal-core/fiqh-issues";

export const dynamic = "force-dynamic";

export default async function LegalCoreArticlePage({ params, searchParams }: { params: { id: string }; searchParams?: { q?: string } }) {
  await requirePagePermission("LEGAL_CORE_VIEW");

  const article = await prisma.legalArticle
    .findUnique({
      where: { id: params.id },
      include: {
        caseLinks: {
          include: {
            judicialCase: {
              select: {
                id: true,
                judgmentTitle: true,
                caseNo: true,
                decisionNo: true,
                court: true,
                cityName: true,
                decisionDateText: true
              }
            }
          },
          orderBy: { createdAt: "desc" },
          take: 8
        }
      }
    })
    .catch(() => null);

  if (!article) notFound();

  const related = await prisma.legalArticle.findMany({
    where: {
      id: { not: article.id },
      OR: [{ lawName: article.lawName }, article.classification ? { classification: article.classification } : { lawName: article.lawName }]
    },
    orderBy: [{ lawName: "asc" }, { articleNumber: "asc" }],
    take: 6,
    select: { id: true, lawName: true, articleNumber: true, title: true }
  });

  const query = (searchParams?.q ?? "").trim();
  const highlightTerms = joinSearchTerms(query);
  const matches = countSearchMatches(article.content, highlightTerms);
  const fiqhIssues = getFiqhIssuesForArticle(article.lawName, article.articleNumber, 8);

  return (
    <LegalCoreShell>
      <div className="space-y-7">
        <LegalCorePageHeader
          title={`المادة ${article.articleNumber.toLocaleString("ar-SA")}`}
          description={`${article.lawName}${article.chapter ? ` | ${article.chapter}` : ""}`}
          actions={
            <>
              <LegalCopyButton text={article.content} label="نسخ نص المادة" />
              <button className="btn btn-outline" type="button"><Pencil size={16} /> تحرير</button>
              <Link className="btn btn-gold" href={`/dashboard/simulations?article=${article.id}`}><Scale size={16} /> استخدام في القاضي حكيم</Link>
              <Link className="btn ho-hero-outline" href={`/dashboard/consultations?article=${article.id}`}><FileText size={16} /> استخدام في الاستشارة</Link>
            </>
          }
        />

        <section className="grid gap-5 xl:grid-cols-[1fr_360px]">
          <div className="space-y-5">
            <article className="rounded-[var(--r-2xl)] border border-[var(--gold-border)] bg-[var(--parchment)] p-8 shadow-[var(--sh-md)]">
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--gold-border)] pb-5">
                <div>
                  <p className="font-mono-legal text-sm text-[var(--gold)]">{article.lawName}</p>
                  <h2 className="mt-2 font-judicial text-4xl font-bold text-[var(--navy)]">المادة {article.articleNumber.toLocaleString("ar-SA")}</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  <LegalTopicBadge tone="emerald">{article.status || "سارية"}</LegalTopicBadge>
                  {article.classification ? <LegalTopicBadge>{article.classification}</LegalTopicBadge> : null}
                </div>
              </div>
              {article.chapter ? <p className="mb-4 font-display-ar text-sm font-semibold text-[var(--ink-60)]">{article.chapter}</p> : null}
              {query ? (
                <div className="mb-5 rounded-[var(--r-lg)] border border-[var(--gold-border)] bg-[var(--gold-ghost)] p-4">
                  <p className="font-display-ar text-sm font-bold text-[var(--navy)]">
                    عدد المطابقات داخل المادة: {matches.toLocaleString("ar-SA")}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a className="btn btn-outline" href="#match-1">المطابقة التالية</a>
                    <a className="btn btn-outline" href={`#match-${Math.max(matches, 1)}`}>المطابقة السابقة</a>
                  </div>
                </div>
              ) : null}
              <p className="font-judicial text-2xl leading-[2.3] text-[var(--ink)]">
                <HighlightedSearchText text={article.content} terms={highlightTerms} anchorPrefix="match" />
              </p>
            </article>

            <LegalCoreCard title="الأحكام والاستشهادات المرتبطة" subtitle="فهرس عكسي للمادة عند اعتماد الاستشهادات القضائية">
              {article.caseLinks.length ? (
                <div className="space-y-3">
                  {article.caseLinks.map((link) => (
                    <article key={link.id} className="rounded-[var(--r-lg)] border border-[var(--ink-08)] bg-white/60 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-mono-legal text-sm text-[var(--gold)]">
                            {link.judicialCase.caseNo ? `قضية ${link.judicialCase.caseNo}` : "قضية غير مرقمة"}
                            {link.judicialCase.decisionNo ? ` | قرار ${link.judicialCase.decisionNo}` : ""}
                          </p>
                          <h3 className="mt-1 font-display-ar text-base font-bold text-[var(--navy)]">
                            {link.judicialCase.judgmentTitle ?? "حكم قضائي مستورد"}
                          </h3>
                          <p className="mt-1 text-xs text-[var(--ink-60)]">
                            {[link.judicialCase.court, link.judicialCase.cityName, link.judicialCase.decisionDateText].filter(Boolean).join(" | ") || "بيانات الحكم غير مكتملة"}
                          </p>
                        </div>
                        <LegalTopicBadge tone={link.reviewStatus === "reviewed" ? "emerald" : "amber"}>{link.reviewStatus}</LegalTopicBadge>
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
                <div className="rounded-[var(--r-lg)] border border-dashed border-[var(--gold-border)] bg-[var(--gold-ghost)] p-5 text-center text-sm leading-7 text-[var(--navy)]">
                  لا توجد أحكام أو استشهادات معتمدة مرتبطة بهذه المادة حتى الآن.
                </div>
              )}
            </LegalCoreCard>

            <div className="grid gap-4 md:grid-cols-2">
              {["الشرح", "شروط التطبيق", "الآثار", "الاستثناءات", "المسائل المرتبطة", "الأحكام القضائية", "المبادئ", "القوالب المرتبطة"].map((section) => (
                <LegalCoreCard key={section} title={section}>
                  <p className="text-sm leading-7 text-[var(--ink-60)]">لم يتم إثراء هذا القسم بعد بمحتوى معتمد. يبقى نص المادة هو المصدر النظامي الأصلي.</p>
                </LegalCoreCard>
              ))}
            </div>
          </div>

          <aside className="space-y-5">
            <LegalCoreCard title="رأس المادة" subtitle="بيانات تعريفية سريعة" icon={<BookOpen size={18} />}>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between gap-3"><dt className="text-[var(--ink-60)]">النظام</dt><dd className="text-left font-semibold text-[var(--navy)]">{article.lawName}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-[var(--ink-60)]">رقم المادة</dt><dd className="font-mono-legal text-[var(--gold)]">{article.articleNumber.toLocaleString("ar-SA")}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-[var(--ink-60)]">التصنيف</dt><dd>{article.classification ?? "غير محدد"}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-[var(--ink-60)]">تاريخ النفاذ</dt><dd>{article.effectiveFrom ? article.effectiveFrom.toLocaleDateString("ar-SA") : "غير مدخل"}</dd></div>
              </dl>
              <div className="mt-4 flex flex-wrap gap-2">
                <button className="btn btn-outline" type="button"><Link2 size={16} /> ربط بمسألة</button>
                <button className="btn btn-outline" type="button"><Scale size={16} /> ربط بحكم</button>
              </div>
            </LegalCoreCard>

            <LegalCitationBlock lawName={article.lawName} articleNumber={article.articleNumber} content={article.content} />
            <FiqhIssuesPanel issues={fiqhIssues} />
            <ExplanationPanel />
            <ComparativeLawPanel />
            <RelatedMaterialsPanel articles={related} />
          </aside>
        </section>
      </div>
    </LegalCoreShell>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, FileText, Scale } from "lucide-react";
import { requirePagePermission } from "@/lib/modules/auth/session";
import { prisma } from "@/lib/prisma";
import { LegalCopyButton } from "@/components/LegalCopyButton";
import { JudgmentText } from "@/components/JudgmentText";
import { LegalCoreCard, LegalCorePageHeader, LegalCoreShell, LegalTopicBadge } from "@/components/legal-core";

export const dynamic = "force-dynamic";

export default async function LegalCoreJudgmentPage({ params }: { params: { id: string } }) {
  await requirePagePermission("LEGAL_CORE_VIEW");

  const judgment = await prisma.judicialCase
    .findUnique({
      where: { id: params.id },
      include: {
        articleLinks: {
          include: { article: { select: { id: true, lawName: true, articleNumber: true, title: true, content: true } } },
          orderBy: { createdAt: "asc" }
        }
      }
    })
    .catch(() => null);

  if (!judgment) notFound();

  const citation = [
    judgment.court,
    judgment.cityName,
    judgment.decisionNo ? `قرار رقم ${judgment.decisionNo}` : null,
    judgment.caseNo ? `قضية رقم ${judgment.caseNo}` : null,
    judgment.decisionDateText
  ].filter(Boolean).join("، ");

  return (
    <LegalCoreShell>
      <div className="space-y-7">
        <LegalCorePageHeader
          title={judgment.judgmentTitle ?? "حكم قضائي مستورد"}
          description={citation || "بيانات الحكم الأساسية تحتاج مراجعة وإثراء."}
          actions={
            <>
              <LegalCopyButton text={citation || judgment.judgmentTitle || judgment.id} label="نسخ الاستشهاد" />
              {judgment.sourceLink ? (
                <a className="btn ho-hero-outline" href={judgment.sourceLink} target="_blank" rel="noreferrer">
                  <ExternalLink size={16} />
                  المصدر
                </a>
              ) : null}
              <Link className="btn btn-gold" href={`/dashboard/simulations?judgment=${judgment.id}`}>
                <Scale size={16} />
                استخدام في القاضي حكيم
              </Link>
              <Link className="btn ho-hero-outline" href={`/dashboard/consultations?judgment=${judgment.id}`}>
                <FileText size={16} />
                استخدام في الاستشارة
              </Link>
            </>
          }
        />

        <section className="grid gap-5 xl:grid-cols-[1fr_360px]">
          <div className="space-y-5">
            <LegalCoreCard title="نص الحكم" subtitle="النص مستورد كما هو، ويحتاج مراجعة قانونية قبل الاعتماد المعرفي">
              <article className="legal-prose rounded-[var(--r-xl)] border border-[var(--gold-border)] bg-[var(--parchment)] p-7 font-judicial text-2xl leading-[2.25] text-[var(--ink)] shadow-[var(--sh-xs)]">
                <JudgmentText
                  text={judgment.judgmentText}
                  links={judgment.articleLinks.map((l) => ({
                    articleId: l.article.id,
                    lawName: l.article.lawName,
                    articleNumber: l.article.articleNumber,
                    reviewStatus: l.reviewStatus
                  }))}
                />
              </article>
            </LegalCoreCard>

            {judgment.appealText ? (
              <LegalCoreCard title="نص الاستئناف أو الاعتراض" subtitle="يعرض عند توفره داخل مصدر الأحكام">
                <article className="legal-prose rounded-[var(--r-xl)] border border-[var(--ink-08)] bg-white/60 p-6 font-judicial text-xl leading-10 text-[var(--ink)]">
                  <JudgmentText
                    text={judgment.appealText}
                    links={judgment.articleLinks.map((l) => ({
                      articleId: l.article.id,
                      lawName: l.article.lawName,
                      articleNumber: l.article.articleNumber,
                      reviewStatus: l.reviewStatus
                    }))}
                  />
                </article>
              </LegalCoreCard>
            ) : null}

            <LegalCoreCard title="المواد النظامية المرتبطة" subtitle="روابط آلية مستخرجة من نص الحكم، ولا تعد اعتمادًا نهائيًا قبل المراجعة">
              {judgment.articleLinks.length ? (
                <div className="space-y-3">
                  {judgment.articleLinks.map((link) => (
                    <article key={link.id} className="rounded-[var(--r-lg)] border border-[var(--ink-08)] bg-white/60 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-mono-legal text-sm text-[var(--gold)]">
                            {link.article.lawName} | المادة {link.article.articleNumber.toLocaleString("ar-SA")}
                          </p>
                          <h3 className="mt-1 font-display-ar text-base font-bold text-[var(--navy)]">{link.article.title}</h3>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <LegalTopicBadge>{relationLabel(link.relationType)}</LegalTopicBadge>
                          <LegalTopicBadge tone="amber">{link.reviewStatus}</LegalTopicBadge>
                        </div>
                      </div>
                      {link.excerpt ? <p className="mt-3 rounded-[var(--r-md)] bg-[var(--gold-ghost)] p-3 text-sm leading-7 text-[var(--ink-70)]">{link.excerpt}</p> : null}
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Link className="btn btn-gold" href={`/dashboard/legal-core/articles/${link.article.id}`}>
                          فتح المادة
                        </Link>
                        <LegalCopyButton text={`${link.article.lawName}، المادة ${link.article.articleNumber}`} label="نسخ الاستشهاد" />
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="rounded-[var(--r-lg)] border border-dashed border-[var(--gold-border)] bg-[var(--gold-ghost)] p-5 text-center text-sm leading-7 text-[var(--navy)]">
                  لا توجد مواد نظامية مرتبطة بهذا الحكم حتى الآن.
                </div>
              )}
            </LegalCoreCard>
          </div>

          <aside className="space-y-5">
            <LegalCoreCard title="بيانات الحكم" subtitle="بيانات تعريفية مستخرجة من مصدر الأحكام">
              <dl className="space-y-3 text-sm">
                <Info label="رقم القضية" value={judgment.caseNo} />
                <Info label="رقم القرار" value={judgment.decisionNo} />
                <Info label="المحكمة" value={judgment.court} />
                <Info label="المدينة" value={judgment.cityName} />
                <Info label="محكمة الاستئناف" value={judgment.courtOfAppeal} />
                <Info label="مدينة الاستئناف" value={judgment.cityOfAppeal} />
                <Info label="تاريخ القرار" value={judgment.decisionDateText} />
                <Info label="تاريخ القضية" value={judgment.caseDateText} />
                <Info label="المصدر" value={judgment.source} />
              </dl>
            </LegalCoreCard>

            <LegalCoreCard title="حالة الربط" subtitle="تقرير سريع عن الاستشهادات">
              <div className="space-y-3">
                <LegalTopicBadge tone={judgment.articleLinks.length ? "emerald" : "amber"}>
                  {judgment.articleLinks.length.toLocaleString("ar-SA")} مادة مرتبطة
                </LegalTopicBadge>
                <LegalTopicBadge tone="amber">{judgment.reviewStatus}</LegalTopicBadge>
                <p className="text-sm leading-7 text-[var(--ink-60)]">
                  الروابط أنشئت آليًا من نص الحكم، ويجب مراجعتها قبل استخدامها كمبدأ أو شرح معتمد.
                </p>
              </div>
            </LegalCoreCard>
          </aside>
        </section>
      </div>
    </LegalCoreShell>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-[var(--ink-60)]">{label}</dt>
      <dd className="text-left font-semibold text-[var(--navy)]">{value || "غير مدخل"}</dd>
    </div>
  );
}

function relationLabel(value: string) {
  const labels: Record<string, string> = {
    applied: "أساس الحكم",
    cited: "استشهاد",
    procedural_reference: "إجرائي",
    supporting_authority: "مرجع مؤيد",
    unclear: "غير محدد"
  };
  return labels[value] ?? value;
}

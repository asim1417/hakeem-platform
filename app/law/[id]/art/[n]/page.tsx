import Link from "next/link";
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { Ban, BookOpen, ChevronLeft, ChevronRight, PencilLine } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { prismaSqlClient } from "@/lib/modules/legal-core/sql-port";
import { getLawPageData, NOT_AVAILABLE, type ArticleView, type LawPageData } from "@/lib/modules/legal-core/law-page-data";
import { resolveLawRoute } from "@/lib/modules/legal-core/law-route";
import {
  REPEAL_NON_RETRO,
  REPEAL_TYPE_LABEL,
  articleAnchor,
  articlePath,
  articleTone,
  citationText,
  lawPath,
  orNA,
  parseArticleKeyParam,
  parseAsOfParam,
  repealSentence,
  splitParagraphs,
} from "@/lib/modules/legal-core/law-page-view";
import { getSiteUrl } from "@/lib/modules/config/site-url";
import { sanitizeDisplayText as clean } from "@/lib/modules/legal-core/display-text";
import { CopyAction } from "@/components/law/CopyAction";
import { LtrDates } from "@/components/law/LtrDates";

export const revalidate = 3600;

type Props = { params: { id: string; n: string }; searchParams?: Record<string, string | string[] | undefined> };

async function load(params: Props["params"], asof: string | null) {
  const parsed = parseArticleKeyParam(params.n);
  if (!parsed) return null;
  const n = parsed.key;
  const db = prismaSqlClient(prisma);
  const r = await resolveLawRoute(db, params.id);
  if (!r) return null;
  const data = await getLawPageData(db, r.systemId, { asOf: asof ?? undefined });
  if (!data) return null;
  const all = data.body.divisions.flatMap((d) => d.articles.map((a) => ({ a, division: d.heading })));
  const i = all.findIndex((x) => x.a.key === n);
  if (i < 0) return null;
  return { r, data, n, a: all[i].a, division: all[i].division, prev: all[i - 1]?.a ?? null, next: all[i + 1]?.a ?? null };
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const asof = parseAsOfParam(searchParams);
  const x = await load(params, asof);
  // احتياط: الحالة الحقيقية (301/404) يحسمها الوسيط (law-route-gate.ts)، لأن app/loading.tsx الجذري يثبّت 200
  // قبل وصول notFound/permanentRedirect من هنا أو من الجسم. هنا يبقى التحويل في المتصفح إن تعذّر جدول الوسيط.
  if (!x) notFound();
  if (x.r.nonCanonical) permanentRedirect(`${articlePath(x.r.canonicalId, x.n)}${asof ? `?asof=${asof}` : ""}`);
  return {
    title: `${x.data.system.name} — ${x.a.heading} | حكيم`,
    description: clean(x.a.effectiveText).slice(0, 155),
    alternates: { canonical: `${getSiteUrl()}${articlePath(x.r.canonicalId, x.n)}` },
    robots: asof ? { index: false, follow: true } : undefined,
  };
}

function StatusBox({ a }: { a: ArticleView }) {
  const tone = articleTone(a.status);
  if (tone === "repealed" && a.repeal) {
    const r = a.repeal;
    return (
      <section className="fn" aria-labelledby="st-h" style={{ maxWidth: "none" }}>
        <p className="fn-title" id="st-h">
          <Ban aria-hidden size={18} /> مادة ملغاة — <LtrDates text={repealSentence(r)} />
        </p>
        <dl>
          <dt>الأداة الملغية</dt>
          <dd>{r.url && r.instrument ? <a href={r.url} rel="noopener noreferrer" target="_blank">{r.instrument}</a> : orNA(r.instrument)}</dd>
          <dt>نوع الإلغاء</dt>
          <dd>{r.type ? `${REPEAL_TYPE_LABEL[r.type]}${r.typeDerived ? " (مشتق من الحالة)" : ""}` : NOT_AVAILABLE}</dd>
          <dt>النظام الملغي</dt>
          <dd>{r.repealingSystem ? <Link href={lawPath(r.repealingSystem.slug)}>{r.repealingSystem.name}</Link> : NOT_AVAILABLE}</dd>
        </dl>
        <p className="keep">{REPEAL_NON_RETRO}</p>
      </section>
    );
  }
  if (tone === "amended" && a.amendment) {
    return (
      <section className="fn" aria-labelledby="st-h" style={{ maxWidth: "none" }}>
        <p className="fn-title" id="st-h">
          <PencilLine aria-hidden size={18} /> مادة معدّلة — النص الظاهر هو الساري.
        </p>
        <dl>
          <dt>أداة التعديل</dt>
          <dd>{a.amendment.url && a.amendment.instrument ? <a href={a.amendment.url} rel="noopener noreferrer" target="_blank">{a.amendment.instrument}</a> : orNA(a.amendment.instrument)}</dd>
          <dt>سارٍ من</dt>
          <dd><LtrDates text={orNA(a.amendment.currentFrom)} /></dd>
        </dl>
        {clean(a.text) !== clean(a.effectiveText) ? (
          <>
            <p className="prev-l">النص السابق</p>
            <div className="prev">{clean(a.text)}</div>
          </>
        ) : null}
      </section>
    );
  }
  return null;
}

function Pager({ id, prev, next }: { id: string; prev: ArticleView | null; next: ArticleView | null }) {
  return (
    <nav className="pager" aria-label="التنقل بين المواد">
      {prev ? (
        <Link href={articlePath(id, prev.key)} rel="prev">
          <small>
            <ChevronRight aria-hidden size={16} /> المادة السابقة
          </small>
          {prev.heading}
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link href={articlePath(id, next.key)} rel="next" className="next">
          <small>
            المادة التالية <ChevronLeft aria-hidden size={16} />
          </small>
          {next.heading}
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

// ع-١٥: صفحة المادة المستقلة — للإحالة والمشاركة والسيو، والقراءة في صفحة النظام («اقرأها في سياق النظام»).
export default async function LawArticlePage({ params, searchParams }: Props) {
  const asof = parseAsOfParam(searchParams);
  const x = await load(params, asof);
  if (!x) notFound();
  if (x.r.nonCanonical) permanentRedirect(`${articlePath(x.r.canonicalId, x.n)}${asof ? `?asof=${asof}` : ""}`);
  const { data, a, division, prev, next } = x;
  const id = x.r.canonicalId;
  const tone = articleTone(a.status);
  const url = `${getSiteUrl()}${articlePath(id, a.key)}`;
  const paras = splitParagraphs(clean(a.effectiveText));
  return <ArticleDoc data={data} a={a} division={division} prev={prev} next={next} id={id} url={url} tone={tone} paras={paras} />;
}

function ArticleDoc({ data, a, division, prev, next, id, url, tone, paras }: {
  data: LawPageData; a: ArticleView; division: string | null; prev: ArticleView | null; next: ArticleView | null; id: string; url: string;
  tone: ReturnType<typeof articleTone>; paras: ReturnType<typeof splitParagraphs>;
}) {
  const cite = citationText(data.system.name, a, url);
  return (
    <div data-law dir="rtl" lang="ar">
      <div className="law-wrap">
        <nav className="crumbs" aria-label="مسار التنقل" style={{ paddingTop: 8 }}>
          <Link href="/legal">الأنظمة القانونية</Link>
          <span className="sep" aria-hidden>/</span>
          <Link href={lawPath(id)}>{data.system.name}</Link>
          <span className="sep" aria-hidden>/</span>
          <span className="crumb-cur" aria-current="page">{a.heading}</span>
        </nav>
        <main id="main" className="ap">
          <header className="law-head">
            <p className="eyebrow">
              <Link href={lawPath(id)}>{data.system.name}</Link>
              {division ? ` · ${division}` : ""}
            </p>
            <h1>{a.heading}</h1>
          </header>
          <div style={{ marginTop: 16 }}>
            <StatusBox a={a} />
          </div>
          <article className={`art art--${tone}`} aria-labelledby="art-text-h" style={{ marginTop: 16 }}>
            <div className="art-head">
              <h2 className="art-h" id="art-text-h">نص المادة</h2>
              <span className="art-tags">
                {tone === "amended" ? <span className="tag tag--amended"><PencilLine aria-hidden size={16} /> معدّلة</span> : null}
                {tone === "repealed" ? <span className="tag tag--repealed"><Ban aria-hidden size={16} /> ملغاة</span> : null}
              </span>
            </div>
            <div className="art-text">
              {paras.map((p, i) =>
                p.num ? (
                  <p className={p.item ? "item" : "para"} key={i}><span className="num">{p.num}</span><span>{p.text}</span></p>
                ) : (
                  <p key={i}>{p.text}</p>
                ),
              )}
            </div>
            {a.repealedLaterOn ? <p className="art-note">أُلغيت لاحقًا في <LtrDates text={a.repealedLaterOn} /></p> : null}
          </article>
          <div className="ap-actions">
            <Link className="lbtn lbtn--primary" href={`${lawPath(id)}#${articleAnchor(a.key)}`}>
              <BookOpen aria-hidden size={20} /> <span>اقرأها في سياق النظام</span>
            </Link>
            <CopyAction kind="cite" label={`نسخ إحالة ${a.heading}`} value={cite} />
            <CopyAction kind="link" label={`نسخ رابط ${a.heading}`} value={url} />
          </div>
          <div className="cite">
            <p><b>الاستناد:</b> <LtrDates text={cite.replace(` — ${url}`, "")} /></p>
            <span className="url code" dir="ltr" translate="no">{url}</span>
          </div>
          <div className="ap-links">
            <section aria-labelledby="ap-r">
              <h2 id="ap-r">الأحكام المعتمدة المرتبطة</h2>
              <p>لم يُربط هذا العرض بالأحكام المعتمدة بعد (ع-١١).</p>
            </section>
            <section aria-labelledby="ap-v">
              <h2 id="ap-v">النسخ السابقة</h2>
              <p>{a.amendment?.versions ? `${a.amendment.versions.toLocaleString("ar-SA")} نسخة مسجّلة.` : "لا توجد نسخ سابقة مسجّلة لهذه المادة."}</p>
            </section>
          </div>
          <Pager id={id} prev={prev} next={next} />
        </main>
      </div>
      <div id="law-live" role="status" aria-live="polite" className="sr-only" />
    </div>
  );
}

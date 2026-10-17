import Link from "next/link";
import { Ban, ExternalLink, Info, PencilLine, ArrowLeft, TriangleAlert, FileText, ChevronDown } from "lucide-react";
import type { ArticleView, DateValue, DivisionView, LawPageData, RepealInfo } from "@/lib/modules/legal-core/law-page-data";
import { NOT_AVAILABLE } from "@/lib/modules/legal-core/law-page-data";
import { sanitizeDisplayText as clean } from "@/lib/modules/legal-core/display-text";
import {
  INSTRUMENT_KIND_LABEL,
  NO_HISTORY_MESSAGE,
  REPEAL_NON_RETRO,
  REPEAL_TYPE_LABEL,
  articleAnchor,
  articlePath,
  articleTone,
  articlesPhrase,
  asOfMode,
  citationText,
  estimateLines,
  filterCounts,
  hasHistory,
  lawPath,
  noHistoryRequestedMessage,
  orNA,
  preambleAnchor,
  preambleDisplay,
  repealSentence,
  shouldCollapse,
  splitParagraphs,
  statusRangeLine,
  statusTone,
} from "@/lib/modules/legal-core/law-page-view";
import { LawToolbar, type TocEntry } from "./LawToolbar";
import { groupOutgoingRepeals as groupOutgoing } from "@/lib/modules/legal-core/law-page-view";
import { PreambleCollapse } from "./PreambleCollapse";
import { CopyAction } from "./CopyAction";
import { LtrDates } from "./LtrDates";

// تاريخ هجري لا ينكسر عند الشرطة (§٥).
export function Hijri({ v }: { v: string }) {
  return (
    <span className="hnum">
      <bdi dir="ltr">{v.replace(/هـ$/, "")}</bdi>هـ
    </span>
  );
}

function DateField({ label, v }: { label: string; v: DateValue }) {
  return (
    <div className="row row--half">
      <dt>{label}</dt>
      <dd>
        {v.hijri || v.gregorian ? (
          <>
            {v.hijri ? <Hijri v={v.hijri} /> : <span className="na">{NOT_AVAILABLE} (هجري)</span>}
            {v.gregorian ? (
              <span className="date2">
                <bdi dir="ltr">{v.gregorian}</bdi>م
              </span>
            ) : null}
          </>
        ) : (
          <span className="na">{NOT_AVAILABLE}</span>
        )}
      </dd>
    </div>
  );
}

function RepealBanner({ r, data }: { r: RepealInfo; data: LawPageData }) {
  const successor = data.card.replacedBy ?? r.repealingSystem;
  return (
    <section className="banner" aria-labelledby="banner-h">
      <h2 id="banner-h">
        <Ban aria-hidden size={20} /> هذا النظام لاغٍ
      </h2>
      <p>
        أُلغي منذ <LtrDates text={orNA(r.effectiveDate)} />
        {successor ? (
          <>
            {" "}بموجب <Link href={lawPath(successor.slug)}>{successor.name}</Link>
          </>
        ) : null}
        {r.instrument ? <> — <LtrDates text={r.instrument} /></> : null}.{r.type ? ` نوع الإلغاء: ${REPEAL_TYPE_LABEL[r.type]}.` : ""}
        {!successor ? " لا نظام بديلًا له في حكيم." : ""}
      </p>
      <p>يبقى نصّه محفوظًا كاملًا، وحاكمًا للوقائع السابقة على إلغائه.</p>
      <div className="actions">
        {successor ? (
          <Link className="lbtn lbtn--primary" href={lawPath(successor.slug)}>
            <span>الساري هو: {successor.name}</span> <ArrowLeft aria-hidden size={20} />
          </Link>
        ) : null}
        {r.url ? (
          <a className="lbtn lbtn--outline" href={r.url} rel="noopener noreferrer" target="_blank">
            <span>نص الأداة الملغية</span> <ExternalLink aria-hidden size={20} className="mirror" />
          </a>
        ) : null}
      </div>
    </section>
  );
}

function LawCardSection({ data }: { data: LawPageData }) {
  const c = data.card;
  const tone = statusTone(c.status.boe);
  const range = statusRangeLine(c.status.boe, c.status.period);
  return (
    <section className="law-card" aria-labelledby="card-h">
      <h2 id="card-h">بطاقة النظام</h2>
      {c.summary ? <p className="summary">{c.summary}</p> : null}
      <div className="cols">
        <dl>
          <div className="row">
            <dt>الاسم</dt>
            <dd>{c.officialName ?? c.name}</dd>
          </div>
          <div className="row row--half">
            <dt>النوع</dt>
            <dd className={c.kind ? undefined : "na"}>{orNA(c.kind)}</dd>
          </div>
          <div className="row row--half">
            <dt>المجال</dt>
            <dd className={c.domain ? undefined : "na"}>{orNA(c.domain)}</dd>
          </div>
          <div className="row">
            <dt>الحالة</dt>
            <dd>
              {tone ? <span className={`status status--${tone}`}>{c.status.label}</span> : <span className="na">{NOT_AVAILABLE}</span>}
              {range ? <span className="status-range">{range}</span> : null}
              {!tone && c.status.hakeem === null ? <span className="status-range">قيد التحقق من المصدر</span> : null}
              {c.repeal?.effectiveDate ? <span className="status-range">منذ <LtrDates text={c.repeal.effectiveDate} /></span> : null}
            </dd>
          </div>
          <div className="row">
            <dt>أدوات الإصدار</dt>
            <dd>
              {c.instruments.length ? (
                <ul>
                  {c.instruments.map((i, k) => (
                    <li key={k}>{i.url ? <a href={i.url} rel="noopener noreferrer" target="_blank">{i.text}</a> : i.text}</li>
                  ))}
                </ul>
              ) : (
                <span className="na">{NOT_AVAILABLE}</span>
              )}
            </dd>
          </div>
          {c.replaces.length ? (
            <div className="row">
              <dt>حلّ محل</dt>
              <dd>
                <ul>
                  {c.replaces.map((s) => (
                    <li key={s.id}>
                      <Link href={lawPath(s.slug)}>{s.name}</Link>
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          ) : null}
        </dl>
        <dl>
          <DateField label="تاريخ الإصدار" v={c.dates.issued} />
          <DateField label="تاريخ النشر" v={c.dates.published} />
          <DateField label="تاريخ النفاذ" v={c.dates.effective} />
          <DateField label="تاريخ التطبيق" v={c.dates.applied} />
        </dl>
      </div>
      <p className="src">
        المصدر الرسمي:{" "}
        {c.officialSource ? (
          <>
            <a href={c.officialSource.url} rel="noopener noreferrer" target="_blank">
              {c.officialSource.name ?? "رابط المصدر"}
            </a>
            {c.officialSource.retrievedOn ? <> · قُرئ في <bdi dir="ltr" className="hnum">{c.officialSource.retrievedOn}</bdi></> : null}
          </>
        ) : (
          <span className="na">{NOT_AVAILABLE}</span>
        )}
      </p>
      {data.outgoingRepeals.length ? (
        <details className="fnd" style={{ marginTop: 12 }}>
          <summary className="lbtn lbtn--outline lbtn--fine fnbtn">
            <Ban aria-hidden size={18} /> <span>ما ألغته أداة إصدار هذا النظام ({data.outgoingRepeals.length.toLocaleString("ar-SA")})</span> <ChevronDown aria-hidden size={18} className="chev" />
          </summary>
          <div className="fn">
            <p className="fn-title">مشتق بمطابقة رقم أداة الإصدار وسنتها، ولم تُحدَّد المادة الملغية بعينها في البيانات بعد.</p>
            <ul>
              {groupOutgoing(data.outgoingRepeals).map((g) => (
                <li key={g.key}>
                  {g.systemId ? <Link href={`${lawPath(g.slug)}#${articleAnchor(g.from)}`}>{g.label}</Link> : g.label}
                </li>
              ))}
            </ul>
          </div>
        </details>
      ) : null}
    </section>
  );
}

function Preamble({ data }: { data: LawPageData }) {
  const p = data.preamble;
  const d = preambleDisplay(p);
  const meta =
    d.mode === "units"
      ? `${d.instrumentCount === 1 ? "أداة إصدار واحدة" : d.instrumentCount === 2 ? "أداتا إصدار" : `${d.instrumentCount} أدوات إصدار`} · ${d.clauseCount} بندًا`
      : null;
  let body: JSX.Element | null = null;
  let texts: string[] = [];
  if (d.mode === "units" && p.units) {
    texts = [...p.units.outside.map((u) => u.text), ...p.units.instruments.flatMap((i) => i.units.map((u) => u.text))];
    body = (
      <>
        {p.units.instruments.map((ins) => {
          const kind = ins.kind ? INSTRUMENT_KIND_LABEL[ins.kind] : null;
          const headingUnits = ins.units.filter((u) => u.type === "preamble_heading");
          const basmala = headingUnits.find((u) => /بسم الله/.test(u.text));
          return (
            <div className="instr" id={`preamble-${ins.index}`} key={ins.index}>
              <h3 className="instr-h">
                {kind ? <span className="kind">{kind}</span> : null}
                {ins.heading ?? headingUnits.filter((u) => u !== basmala).map((u) => u.text.trim()).join(" ")}
              </h3>
              {ins.units.map((u) => {
                const t = clean(u.text).trim();
                if (u.type === "preamble_heading") return u === basmala ? <p className="basmala" key={u.id}>{t}</p> : null;
                if (u.type === "opening") return <p className="opening pre-raw" key={u.id}>{t}</p>;
                if (u.type === "recital") return <p className="recital" key={u.id}>{t}</p>;
                if (u.type === "enacting_formula") return <p className="enact" key={u.id}>{t}</p>;
                if (u.type === "signature") return <p className="signature" key={u.id}>{t}</p>;
                if (u.type === "operative_clause") {
                  const id = preambleAnchor(u.anchor) ?? undefined;
                  const m = t.match(/^([^:：]{1,24}[:：])\s*/);
                  const ord = m ? m[1] : u.label ?? "";
                  const rest = m ? t.slice(m[0].length) : t;
                  return (
                    <p className="clause" id={id} key={u.id}>
                      <a className="ord" href={id ? `#${id}` : undefined} aria-label={`رابط البند ${ord.replace(/[:：]$/, "")} من ${kind ?? "الأداة"}`}>
                        {ord}
                      </a>
                      <span>{rest}</span>
                    </p>
                  );
                }
                return <p className="pre-raw" key={u.id}>{t}</p>;
              })}
            </div>
          );
        })}
      </>
    );
  } else if (d.mode === "blocks" && p.sourceBlocks) {
    texts = p.sourceBlocks.blocks.map((b) => b.text);
    body = (
      <>
        {p.sourceBlocks.blocks.map((b, i) => (
          <div className="instr" id={`preamble-${i + 1}`} key={i}>
            {b.heading ? (
              <h3 className="instr-h">
                {INSTRUMENT_KIND_LABEL[b.kind] ? <span className="kind">{INSTRUMENT_KIND_LABEL[b.kind]}</span> : null}
                {b.heading}
              </h3>
            ) : null}
            <p className="pre-raw">{clean(b.text)}</p>
          </div>
        ))}
      </>
    );
  } else if (d.mode === "legacy" && p.legacy) {
    texts = [p.legacy.text];
    body = <p className="pre-raw">{clean(p.legacy.text)}</p>;
  }
  return (
    <section id="preamble" aria-labelledby="pre-h">
      <div className="sec-h">
        <h2 id="pre-h">المقدمة</h2>
        {meta ? <span className="meta">{meta}</span> : null}
        {d.tag ? (
          <span className="tag tag--incomplete">
            <TriangleAlert aria-hidden size={16} /> {d.tag}
          </span>
        ) : null}
      </div>
      {d.mode === "legacy" ? (
        <p className="pre-src" style={{ marginTop: 0, marginBottom: 12 }}>
          {d.note}{" "}
          {d.sourceUrl ? (
            <a href={d.sourceUrl} rel="noopener noreferrer" target="_blank">
              المقدمة كاملة في المصدر الرسمي
            </a>
          ) : null}
        </p>
      ) : null}
      {body ? (
        <PreambleCollapse initiallyCollapsed={shouldCollapse(estimateLines(texts))}>{body}</PreambleCollapse>
      ) : (
        <div className="pre-none">
          {d.note}{" "}
          {d.sourceUrl ? (
            <a href={d.sourceUrl} rel="noopener noreferrer" target="_blank">
              اقرأها في المصدر الرسمي
            </a>
          ) : null}
        </div>
      )}
    </section>
  );
}

function RepealFootnote({ r, id, title }: { r: RepealInfo; id: string; title: string }) {
  return (
    <details className="fnd" id={id}>
      <summary className="lbtn lbtn--outline lbtn--fine fnbtn">
        <Ban aria-hidden size={18} /> <span>{title}</span> <ChevronDown aria-hidden size={18} className="chev" />
      </summary>
      <div className="fn">
        <p className="fn-title"><LtrDates text={repealSentence(r)} /></p>
        <dl>
          <dt>الأداة الملغية</dt>
          <dd>{r.url && r.instrument ? <a href={r.url} rel="noopener noreferrer" target="_blank">{r.instrument}</a> : orNA(r.instrument)}</dd>
          <dt>نوع الإلغاء</dt>
          <dd>{r.type ? `${REPEAL_TYPE_LABEL[r.type]}${r.typeDerived ? " (مشتق من الحالة)" : ""}` : NOT_AVAILABLE}</dd>
          <dt>نافذ من</dt>
          <dd><LtrDates text={orNA(r.effectiveDate)} /></dd>
          <dt>النظام الملغي</dt>
          <dd>{r.repealingSystem ? <Link href={lawPath(r.repealingSystem.slug)}>{r.repealingSystem.name}</Link> : NOT_AVAILABLE}</dd>
          <dt>المادة الملغية</dt>
          <dd>
            {r.repealingArticle && r.repealingSystem ? (
              <Link href={`${lawPath(r.repealingSystem.slug)}#${articleAnchor(r.repealingArticle.articleNumber)}`}>المادة {r.repealingArticle.articleNumber}</Link>
            ) : (
              <>{NOT_AVAILABLE} (لا تخزّن البيانات المادة الملغية بعينها بعد)</>
            )}
          </dd>
        </dl>
        <p className="keep">{REPEAL_NON_RETRO}</p>
      </div>
    </details>
  );
}

function ArticleBlock({ a, data, id, base, level }: { a: ArticleView; data: LawPageData; id: string; base: string; level: 3 | 4 }) {
  const tone = articleTone(a.status);
  const H = level === 3 ? "h3" : "h4";
  const shown = clean(a.effectiveText);
  const paras = splitParagraphs(shown);
  const url = `${base}${articlePath(id, a.number)}`;
  const partRepealed = a.status === "ملغى" && !a.inheritedFromWork && Boolean(data.body.divisions.find((d) => d.articles.includes(a))?.allRepealed);
  const showRepealFn = tone === "repealed" && a.repeal && !a.inheritedFromWork && !partRepealed;
  return (
    <article className={`art art--${tone === "plain" ? "plain" : tone}`} id={articleAnchor(a.number)} aria-labelledby={`${articleAnchor(a.number)}-h`} data-tone={tone}>
      <div className="art-head">
        <H className="art-h" id={`${articleAnchor(a.number)}-h`} tabIndex={-1}>
          {a.heading}
        </H>
        <span className="art-tags">
          {tone === "amended" ? (
            <span className="tag tag--amended">
              <PencilLine aria-hidden size={16} /> معدّلة
            </span>
          ) : null}
          {tone === "repealed" ? (
            <span className="tag tag--repealed">
              <Ban aria-hidden size={16} /> ملغاة
            </span>
          ) : null}
        </span>
        <span className="art-tools">
          <CopyAction kind="text" label={`نسخ نص ${a.heading}`} value={`${a.heading}\n${shown}`} />
          <CopyAction kind="cite" label={`نسخ إحالة ${a.heading}`} value={citationText(data.system.name, a, url)} />
          <CopyAction kind="link" label={`نسخ رابط ${a.heading}`} value={url} />
          <Link className="iconbtn iconbtn--fine" href={articlePath(id, a.number)} aria-label={`فتح صفحة ${a.heading}`}>
            <FileText aria-hidden size={20} />
            <span className="tip" aria-hidden>صفحة المادة</span>
          </Link>
        </span>
      </div>
      <div className="art-text">
        {paras.length > 1 || paras[0]?.num ? (
          paras.map((p, i) =>
            p.num ? (
              <p className={p.item ? "item" : "para"} key={i} id={p.item ? undefined : `${articleAnchor(a.number)}-p-${i + 1}`}>
                <span className="num">{p.num}</span>
                <span>{p.text}</span>
              </p>
            ) : (
              <p key={i}>{p.text}</p>
            ),
          )
        ) : (
          <p>{shown}</p>
        )}
      </div>
      {a.repealedLaterOn ? <p className="art-note">أُلغيت لاحقًا في <LtrDates text={a.repealedLaterOn} /></p> : null}
      {a.amendment?.pendingFrom && tone !== "repealed" ? <p className="art-note">عُدّلت لاحقًا في <LtrDates text={a.amendment.pendingFrom} /></p> : null}
      {tone === "amended" && a.amendment || showRepealFn ? (
        <div className="art-foot">
          {tone === "amended" && a.amendment ? (
            <details className="fnd">
              <summary className="lbtn lbtn--outline lbtn--fine fnbtn">
                <PencilLine aria-hidden size={18} /> <span>تعديلات المادة</span> <ChevronDown aria-hidden size={18} className="chev" />
              </summary>
              <div className="fn">
                <p className="fn-title">النص الظاهر هو الساري.</p>
                <dl>
                  <dt>أداة التعديل</dt>
                  <dd>{a.amendment.url && a.amendment.instrument ? <a href={a.amendment.url} rel="noopener noreferrer" target="_blank">{a.amendment.instrument}</a> : orNA(a.amendment.instrument)}</dd>
                  <dt>سارٍ من</dt>
                  <dd><LtrDates text={orNA(a.amendment.currentFrom)} /></dd>
                  <dt>عدد النسخ</dt>
                  <dd>{a.amendment.versions.toLocaleString("ar-SA")}</dd>
                </dl>
                {a.text && clean(a.text) !== shown ? (
                  <>
                    <p className="prev-l">النص السابق</p>
                    <div className="prev">{clean(a.text)}</div>
                  </>
                ) : null}
              </div>
            </details>
          ) : null}
          {showRepealFn && a.repeal ? <RepealFootnote r={a.repeal} id={`${articleAnchor(a.number)}-repeal`} title="بيان الإلغاء" /> : null}
        </div>
      ) : null}
    </article>
  );
}

function Division({ d, i, data, id, base }: { d: DivisionView; i: number; data: LawPageData; id: string; base: string }) {
  const first = d.articles.find((a) => a.repeal);
  if (!d.heading) {
    return (
      <section className="part" id={`part-${i + 1}`} aria-label={`مواد ${i + 1}`} data-part>
        {d.articles.map((a) => (
          <ArticleBlock key={a.id} a={a} data={data} id={id} base={base} level={3} />
        ))}
      </section>
    );
  }
  return (
    <section className={`part${d.allRepealed ? " part--repealed" : ""}`} id={`part-${i + 1}`} aria-labelledby={`part-${i + 1}-h`} data-part>
      <h3 className="part-h" id={`part-${i + 1}-h`}>
        <span>{d.heading}</span>
      </h3>
      {d.allRepealed ? (
        <>
          <div className="part-meta">
            <span className="tag tag--repealed">
              <Ban aria-hidden size={16} /> الباب ملغى
            </span>
          </div>
          {first?.repeal ? (
            <div className="fn--part">
              <RepealFootnote r={first.repeal} id={`part-${i + 1}-repeal`} title="بيان الإلغاء" />
            </div>
          ) : null}
        </>
      ) : null}
      {d.articles.map((a) => (
        <ArticleBlock key={a.id} a={a} data={data} id={id} base={base} level={4} />
      ))}
    </section>
  );
}

export function LawDocument({ data, id, base, asofRequested }: { data: LawPageData; id: string; base: string; asofRequested: string | null }) {
  const counts = filterCounts(data.body.counts);
  const history = hasHistory(data);
  const mode = asOfMode(asofRequested, history);
  const toc: TocEntry[] = data.body.divisions.some((d) => d.heading)
    ? data.body.divisions.map((d, i) => ({ href: `#part-${i + 1}`, label: d.heading ?? `مواد ${i + 1}`, n: d.articles.length, repealed: d.allRepealed }))
    : data.body.divisions.flatMap((d) => d.articles.map((a) => ({ href: `#${articleAnchor(a.number)}`, label: a.heading, n: null, repealed: a.status === "ملغى" })));
  const divisionsCount = data.body.divisions.filter((d) => d.heading).length;
  const lastArticle = data.body.divisions.at(-1)?.articles.at(-1);
  return (
    <div data-law dir="rtl" lang="ar">
      <a className="skip" href="#law-text">
        تخطَّ إلى نص النظام
      </a>
      <div className="law-wrap">
        <nav className="crumbs" aria-label="مسار التنقل" style={{ paddingTop: 8 }}>
          <Link href="/legal">الأنظمة القانونية</Link>
          <span className="sep" aria-hidden>
            /
          </span>
          <span className="crumb-cur" aria-current="page">
            {data.system.name}
          </span>
        </nav>
        <main id="main">
          <header className="law-head">
            <p className="eyebrow">{[data.card.kind, data.card.domain].filter(Boolean).join(" · ") || NOT_AVAILABLE}</p>
            <h1>{data.system.name}</h1>
            <p className="meta">
              {articlesPhrase(data.system.articleCount)}
              {divisionsCount ? ` · الأبواب والفصول: ${divisionsCount.toLocaleString("ar-SA")}` : ""}
            </p>
          </header>
          {data.card.repeal ? <RepealBanner r={data.card.repeal} data={data} /> : null}
          <LawCardSection data={data} />
          <LawToolbar
            lawId={id}
            counts={counts}
            toc={toc}
            asof={asofRequested}
            history={history}
            hasArticles={data.system.articleCount > 0}
          />
          <div className="law-grid">
            <nav className="toc" aria-label="فهرس النظام">
              <h2>فهرس النظام</h2>
              <ol>
                <li>
                  <a href="#preamble">
                    <span className="lbl">المقدمة</span>
                  </a>
                </li>
                {toc.map((t) => (
                  <li key={t.href}>
                    <a href={t.href}>
                      <span className="lbl">
                        {t.label}
                        {t.repealed ? <span className="tag tag--repealed">ملغى</span> : null}
                      </span>
                      {t.n !== null ? <span className="n">{t.n.toLocaleString("ar-SA")}</span> : null}
                    </a>
                  </li>
                ))}
                {lastArticle ? (
                  <li>
                    <a href={`#${articleAnchor(lastArticle.number)}`}>
                      <span className="lbl">آخر مادة</span>
                    </a>
                  </li>
                ) : null}
              </ol>
            </nav>
            <div className="sheet">
              <Preamble data={data} />
              <section id="law-text" aria-labelledby="text-h">
                <div className="sec-h">
                  <h2 id="text-h">نص النظام</h2>
                  <span className="meta">{articlesPhrase(data.system.articleCount)}</span>
                </div>
                {mode === "no_history" && asofRequested ? (
                  <div className="sheet-notice" role="note">
                    <Info aria-hidden size={20} />
                    <p>{noHistoryRequestedMessage(asofRequested)}</p>
                  </div>
                ) : null}
                {mode === "historical" && asofRequested ? (
                  <div className="sheet-notice" role="note">
                    <Info aria-hidden size={20} />
                    <div>
                      <p>
                        تعرض الصفحة النظام كما كان نافذًا في <bdi dir="ltr">{asofRequested}</bdi>م. التعديلات والإلغاءات اللاحقة لهذا التاريخ غير مطبّقة.
                      </p>
                      <Link className="lbtn lbtn--outline lbtn--fine" href={lawPath(id)}>
                        العودة إلى النص الساري
                      </Link>
                    </div>
                  </div>
                ) : null}
                {data.system.articleCount ? (
                  data.body.divisions.map((d, i) => <Division key={i} d={d} i={i} data={data} id={id} base={base} />)
                ) : (
                  <div className="empty">
                    <p>لم تُنشر مواد هذا النظام في حكيم بعد.</p>
                    {data.card.officialSource ? (
                      <a href={data.card.officialSource.url} rel="noopener noreferrer" target="_blank">
                        اقرأ النص في المصدر الرسمي
                      </a>
                    ) : null}
                  </div>
                )}
                {data.system.articleCount ? <p className="endrow">نهاية النظام · {articlesPhrase(data.system.articleCount)}</p> : null}
                {!history ? <p className="sr-only">{NO_HISTORY_MESSAGE}</p> : null}
              </section>
            </div>
          </div>
        </main>
      </div>
      <footer className="site-foot">
        <Link href="/legal">فهرس الأنظمة</Link>
        <Link href="/api-docs">توثيق API</Link>
        <Link href="/terms">الشروط</Link>
        <Link href="/privacy">الخصوصية</Link>
        <span style={{ marginInlineStart: "auto", alignSelf: "center" }}>© منصّة حكيم — المعرفة القضائية السعودية</span>
      </footer>
      <div id="law-live" role="status" aria-live="polite" className="sr-only" />
    </div>
  );
}

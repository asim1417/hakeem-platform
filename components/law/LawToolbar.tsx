"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { CalendarClock, ChevronDown, ChevronUp, Ellipsis, Link as LinkIcon, ListTree, Printer, Search, SlidersHorizontal, X } from "lucide-react";
import {
  LAW_FILTERS,
  NO_HISTORY_MESSAGE,
  arNum,
  findMatches,
  lawPath,
  matchCounter,
  matchesFilter,
  parseFilter,
  resolvePreambleAlias,
  type ArticleTone,
  type LawFilter,
} from "@/lib/modules/legal-core/law-page-view";
import { announce, copyText } from "./CopyAction";

export interface TocEntry {
  href: string;
  label: string;
  n: number | null;
  repealed: boolean;
}

const sheetRoot = () => document.querySelector<HTMLElement>("[data-law] .sheet");

/** يزيل إبراز البحث السابق ويعيد النص كما كان. */
function clearMarks(root: HTMLElement) {
  root.querySelectorAll("mark.hit").forEach((m) => {
    const parent = m.parentNode;
    if (!parent) return;
    parent.replaceChild(document.createTextNode(m.textContent ?? ""), m);
    parent.normalize();
  });
}

/** يبرز المطابقات في عقد النص داخل المقدمة وعناوين المواد ونصوصها. */
function markMatches(root: HTMLElement, query: string): HTMLElement[] {
  const scopes = root.querySelectorAll<HTMLElement>("#pre-body, .art-h, .art-text");
  const marks: HTMLElement[] = [];
  scopes.forEach((scope) => {
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
    const nodes: Text[] = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n as Text);
    for (const node of nodes) {
      const text = node.data;
      const hits = findMatches(text, query);
      if (!hits.length) continue;
      const frag = document.createDocumentFragment();
      let last = 0;
      for (const [s, e] of hits) {
        if (s > last) frag.appendChild(document.createTextNode(text.slice(last, s)));
        const m = document.createElement("mark");
        m.className = "hit";
        m.textContent = text.slice(s, e);
        frag.appendChild(m);
        marks.push(m);
        last = e;
      }
      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
      node.parentNode?.replaceChild(frag, node);
    }
  });
  return marks;
}

function applyFilter(f: LawFilter): number {
  let shown = 0;
  document.querySelectorAll<HTMLElement>("[data-law] .art[data-tone]").forEach((el) => {
    const ok = matchesFilter((el.dataset.tone as ArticleTone) ?? "plain", f);
    if (ok) {
      el.removeAttribute("data-filtered");
      shown++;
    } else el.setAttribute("data-filtered", "");
  });
  document.querySelectorAll<HTMLElement>("[data-law] [data-part]").forEach((p) => {
    const any = p.querySelector(".art:not([data-filtered])");
    if (any) p.removeAttribute("data-filtered");
    else p.setAttribute("data-filtered", "");
  });
  return shown;
}

function flash(target: HTMLElement) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const cls = reduce ? "is-flash-static" : "is-flash";
  target.classList.remove("is-flash", "is-flash-static");
  void target.offsetWidth;
  target.classList.add(cls);
  window.setTimeout(() => target.classList.remove(cls), reduce ? 3000 : 1700);
}

function Filters({ name, filter, counts, onChange, bar }: { name: string; filter: LawFilter; counts: Record<LawFilter, number>; onChange: (f: LawFilter) => void; bar?: boolean }) {
  return (
    <fieldset className={`filters${bar ? " filters--bar" : ""}`}>
      <legend>عرض المواد</legend>
      {LAW_FILTERS.map((o) => (
        <label className="seg" key={o.id}>
          <input type="radio" name={name} value={o.id} checked={filter === o.id} disabled={o.id !== "all" && counts[o.id] === 0} onChange={() => onChange(o.id)} />
          <span>
            {o.label} <span className="n">{arNum(counts[o.id])}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}

export function LawToolbar({
  lawId,
  counts,
  toc,
  asof,
  history,
  hasArticles,
}: {
  lawId: string;
  counts: Record<LawFilter, number>;
  toc: TocEntry[];
  asof: string | null;
  history: boolean;
  hasArticles: boolean;
}) {
  const [query, setQuery] = useState("");
  const [total, setTotal] = useState(0);
  const [current, setCurrent] = useState(0);
  const [hiddenHits, setHiddenHits] = useState(0);
  const [filter, setFilter] = useState<LawFilter>("all");
  const [asofOpen, setAsofOpen] = useState(false);
  const marksRef = useRef<HTMLElement[]>([]);
  const dlgToc = useRef<HTMLDialogElement>(null);
  const dlgFilters = useRef<HTMLDialogElement>(null);
  const dlgMore = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  const visibleMarks = useCallback(() => marksRef.current.filter((m) => !m.closest("[data-filtered]")), []);

  const focusMatch = useCallback(
    (i: number) => {
      const vis = visibleMarks();
      vis.forEach((m) => m.classList.remove("hit--current"));
      const m = vis[i];
      if (!m) return;
      m.classList.add("hit--current");
      if (m.closest("#pre-body")) window.dispatchEvent(new Event("law:expand-preamble"));
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.setTimeout(() => m.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" }), 20);
      const art = m.closest(".art");
      const where = art?.querySelector(".art-h")?.textContent ?? (m.closest("#pre-body") ? "المقدمة" : "");
      announce(`المطابقة ${arNum(i + 1)} من ${arNum(vis.length)}${where ? `، ${where}` : ""}`);
    },
    [visibleMarks],
  );

  const runSearch = useCallback(
    (q: string) => {
      const root = sheetRoot();
      if (!root) return;
      clearMarks(root);
      marksRef.current = q.trim().length >= 2 ? markMatches(root, q) : [];
      const vis = visibleMarks();
      setTotal(vis.length);
      setHiddenHits(marksRef.current.length - vis.length);
      setCurrent(0);
      if (vis.length) focusMatch(0);
      else if (q.trim().length >= 2) announce(`لا مطابقة لـ«${q.trim()}» في هذا النظام.`);
    },
    [focusMatch, visibleMarks],
  );

  useEffect(() => {
    const t = window.setTimeout(() => runSearch(query), 250);
    return () => window.clearTimeout(t);
  }, [query, runSearch]);

  const changeFilter = useCallback(
    (f: LawFilter, opts: { silent?: boolean } = {}) => {
      setFilter(f);
      const shown = applyFilter(f);
      const url = new URL(window.location.href);
      if (f === "all") url.searchParams.delete("show");
      else url.searchParams.set("show", f);
      window.history.replaceState(window.history.state, "", url.toString());
      if (!opts.silent) announce(`يُعرض ${arNum(shown)}: ${LAW_FILTERS.find((o) => o.id === f)?.label}`);
      const vis = visibleMarks();
      setTotal(vis.length);
      setHiddenHits(marksRef.current.length - vis.length);
      setCurrent(0);
    },
    [visibleMarks],
  );

  // المرشح من الرابط، والوصول بمرساة (إبراز مؤقت وتركيز العنوان)، وفتح الحواشي عند الطباعة.
  useEffect(() => {
    const initial = parseFilter(new URLSearchParams(window.location.search).get("show"));
    if (initial !== "all") changeFilter(initial, { silent: true });
    const hash = window.location.hash;
    if (hash) {
      const id = resolvePreambleAlias(hash);
      if (id.startsWith("preamble")) window.dispatchEvent(new Event("law:expand-preamble"));
      window.setTimeout(() => {
        const el = document.getElementById(id);
        if (!el) return;
        el.scrollIntoView({ block: "start" });
        const target = el.closest<HTMLElement>(".art, .clause") ?? el;
        flash(target);
        const h = target.querySelector<HTMLElement>(".art-h");
        h?.focus({ preventScroll: true });
      }, 60);
    }
    const opened: HTMLDetailsElement[] = [];
    const before = () => {
      document.querySelectorAll<HTMLDetailsElement>("[data-law] details.fnd:not([open])").forEach((d) => {
        d.open = true;
        opened.push(d);
      });
    };
    const after = () => {
      opened.splice(0).forEach((d) => (d.open = false));
    };
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => {
      window.removeEventListener("beforeprint", before);
      window.removeEventListener("afterprint", after);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const step = (d: 1 | -1) => {
    if (!total) return;
    const n = (current + d + total) % total;
    setCurrent(n);
    focusMatch(n);
  };

  const openDlg = (ref: React.RefObject<HTMLDialogElement>, e: React.MouseEvent<HTMLElement>) => {
    opener.current = e.currentTarget;
    ref.current?.showModal();
  };
  const closeDlg = (ref: React.RefObject<HTMLDialogElement>) => {
    ref.current?.close();
    opener.current?.focus();
  };

  const copyLink = async () => {
    const url = `${window.location.origin}${lawPath(lawId)}`;
    const ok = await copyText(url);
    announce(ok ? `نُسخ الرابط الدائم: ${url.replace(/^https?:\/\//, "")}` : "تعذّر النسخ.");
  };
  const filterLabel = LAW_FILTERS.find((o) => o.id === filter)?.label ?? "الكل";

  const asofPanel = asofOpen ? (
    <div className="asof-panel" id="asof">
      {history ? (
        <form method="get" action={lawPath(lawId)} className="row">
          <label>
            التاريخ (ميلادي)
            <input type="date" name="asof" defaultValue={asof ?? ""} required />
          </label>
          <button type="submit" className="lbtn lbtn--primary lbtn--fine">
            عرض
          </button>
          {asof ? (
            <Link className="lbtn lbtn--outline lbtn--fine" href={lawPath(lawId)}>
              العودة إلى اليوم
            </Link>
          ) : null}
        </form>
      ) : null}
      <p className="hint">{history ? "يُعرض النظام كما كان نافذًا في التاريخ المختار." : NO_HISTORY_MESSAGE}</p>
    </div>
  ) : null;

  return (
    <section className="law-toolbar" aria-label="أدوات النظام">
      <form
        role="search"
        className="search"
        onSubmit={(e) => {
          e.preventDefault();
        }}
      >
        <Search aria-hidden size={20} />
        <input
          type="search"
          aria-label="ابحث داخل هذا النظام"
          placeholder="ابحث داخل النظام"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              step(e.shiftKey ? -1 : 1);
            }
          }}
        />
        {query.trim().length >= 2 ? (
          <span className="count" aria-hidden>
            {matchCounter(total ? current + 1 : 0, total)}
          </span>
        ) : null}
        <button type="button" className="iconbtn" aria-label="المطابقة السابقة" onClick={() => step(-1)} aria-disabled={!total}>
          <ChevronUp aria-hidden size={20} />
        </button>
        <button type="button" className="iconbtn" aria-label="المطابقة التالية" onClick={() => step(1)} aria-disabled={!total}>
          <ChevronDown aria-hidden size={20} />
        </button>
      </form>
      {hiddenHits > 0 ? (
        <p className="search-hidden">
          {arNum(hiddenHits)} مطابقة في مواد مخفية بالمرشح «{filterLabel}».{" "}
          <button type="button" onClick={() => changeFilter("all")}>
            إظهار الكل
          </button>
        </p>
      ) : null}
      {query.trim().length >= 2 && !total && !hiddenHits ? <p className="search-hidden">لا مطابقة لـ«{query.trim()}» في هذا النظام. جرّب كلمة أقصر أو جذرها.</p> : null}

      {hasArticles ? <Filters name="law-filter" filter={filter} counts={counts} onChange={changeFilter} bar /> : null}

      <div className="tools-end desk-only">
        <button type="button" className="lbtn lbtn--outline lbtn--fine" aria-expanded={asofOpen} aria-controls="asof" onClick={() => setAsofOpen((o) => !o)}>
          <CalendarClock aria-hidden size={20} /> <span>كما في تاريخ: {asof ?? "اليوم"}</span>
        </button>
        <button type="button" className="iconbtn iconbtn--fine" aria-label="طباعة / PDF" onClick={() => window.print()}>
          <Printer aria-hidden size={20} />
          <span className="tip" aria-hidden>
            طباعة / PDF
          </span>
        </button>
        <button type="button" className="iconbtn iconbtn--fine" aria-label="نسخ الرابط الدائم" onClick={copyLink}>
          <LinkIcon aria-hidden size={20} />
          <span className="tip" aria-hidden>
            نسخ الرابط الدائم
          </span>
        </button>
      </div>

      <div className="mobile-row">
        <button type="button" className="lbtn lbtn--outline" onClick={(e) => openDlg(dlgToc, e)}>
          <ListTree aria-hidden className="mirror" /> <span>الفهرس</span>
        </button>
        <button type="button" className="lbtn lbtn--outline" onClick={(e) => openDlg(dlgFilters, e)} disabled={!hasArticles} aria-label={`عرض المواد: ${filterLabel}`}>
          <SlidersHorizontal aria-hidden /> <span>{filter === "all" ? "الكل" : filterLabel.replace(" فقط", "")}</span>
        </button>
        <button type="button" className="lbtn lbtn--outline" aria-expanded={asofOpen} aria-controls="asof" onClick={() => setAsofOpen((o) => !o)}>
          <CalendarClock aria-hidden /> <span>كما في</span>
        </button>
        <button type="button" className="lbtn lbtn--outline" onClick={(e) => openDlg(dlgMore, e)}>
          <Ellipsis aria-hidden /> <span>المزيد</span>
        </button>
      </div>
      {asofPanel}

      <dialog ref={dlgToc} className="sheet-dlg" aria-labelledby="dlg-toc-h">
        <div className="dlg-head">
          <h2 id="dlg-toc-h">فهرس النظام</h2>
          <button type="button" className="iconbtn" aria-label="إغلاق" onClick={() => closeDlg(dlgToc)}>
            <X aria-hidden />
          </button>
        </div>
        <div className="dlg-body">
          <nav className="toc" aria-label="فهرس النظام">
            <ol>
              <li>
                <a href="#preamble" onClick={() => dlgToc.current?.close()}>
                  <span className="lbl">المقدمة</span>
                </a>
              </li>
              {toc.map((t) => (
                <li key={t.href}>
                  <a href={t.href} onClick={() => dlgToc.current?.close()}>
                    <span className="lbl">
                      {t.label}
                      {t.repealed ? <span className="tag tag--repealed">ملغى</span> : null}
                    </span>
                    {t.n !== null ? <span className="n">{arNum(t.n)}</span> : null}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </div>
      </dialog>

      <dialog ref={dlgFilters} className="sheet-dlg" aria-labelledby="dlg-f-h">
        <div className="dlg-head">
          <h2 id="dlg-f-h">عرض المواد</h2>
          <button type="button" className="iconbtn" aria-label="إغلاق" onClick={() => closeDlg(dlgFilters)}>
            <X aria-hidden />
          </button>
        </div>
        <div className="dlg-body">
          <Filters
            name="law-filter-m"
            filter={filter}
            counts={counts}
            onChange={(f) => {
              changeFilter(f);
              closeDlg(dlgFilters);
            }}
          />
        </div>
      </dialog>

      <dialog ref={dlgMore} className="sheet-dlg" aria-labelledby="dlg-m-h">
        <div className="dlg-head">
          <h2 id="dlg-m-h">المزيد</h2>
          <button type="button" className="iconbtn" aria-label="إغلاق" onClick={() => closeDlg(dlgMore)}>
            <X aria-hidden />
          </button>
        </div>
        <div className="dlg-body">
          <ul className="menu">
            <li>
              <button
                type="button"
                onClick={() => {
                  closeDlg(dlgMore);
                  window.print();
                }}
              >
                <Printer aria-hidden /> طباعة / PDF
              </button>
            </li>
            <li>
              <button
                type="button"
                onClick={async () => {
                  await copyLink();
                  closeDlg(dlgMore);
                }}
              >
                <LinkIcon aria-hidden /> نسخ الرابط الدائم
              </button>
            </li>
          </ul>
        </div>
      </dialog>
    </section>
  );
}

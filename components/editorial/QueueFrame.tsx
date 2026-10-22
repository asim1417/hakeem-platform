"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { fmt } from "./logic";
import { btnClass } from "./ui";

interface CountsCtx {
  counts: Record<string, number>;
  waiting: number;
  /** ينقص عدّاد اللسان بعد استجابة نجاح فقط (ق٢٤-٢). */
  decrement: (tab: string, n?: number) => void;
  addWaiting: (n: number) => void;
}

const Ctx = createContext<CountsCtx | null>(null);

export function useQueueCounts(): CountsCtx {
  const value = useContext(Ctx);
  if (!value) throw new Error("useQueueCounts خارج QueueFrame");
  return value;
}

export interface QueueTabDef {
  key: string;
  label: string;
  href: string;
  count: number | null;
}

/** ألسنة الطابور روابط في nav بـ aria-current، والعدد داخل التسمية (ح١٦، ٥-٢). */
export function QueueFrame({ tabs, current, waiting, children }: { tabs: QueueTabDef[]; current: string; waiting: number; children: ReactNode }) {
  const [counts, setCounts] = useState<Record<string, number>>(() =>
    Object.fromEntries(tabs.filter((t) => t.count !== null).map((t) => [t.key, t.count as number])),
  );
  const [waitingCount, setWaiting] = useState(waiting);
  const decrement = useCallback((tab: string, n = 1) => setCounts((c) => ({ ...c, [tab]: Math.max((c[tab] ?? 0) - n, 0) })), []);
  const addWaiting = useCallback((n: number) => setWaiting((w) => w + n), []);
  const value = useMemo(() => ({ counts, waiting: waitingCount, decrement, addWaiting }), [addWaiting, counts, decrement, waitingCount]);
  return (
    <Ctx.Provider value={value}>
      <nav aria-label="أقسام الطابور" className="dk-tabs">
        {tabs.map((t) => (
          <Link key={t.key} href={t.href} aria-current={t.key === current ? "page" : undefined} className="dk-tab">
            <span>
              {t.label}
              {t.key in counts ? ` (${fmt(counts[t.key])})` : ""}
            </span>
          </Link>
        ))}
      </nav>
      {children}
    </Ctx.Provider>
  );
}

/** «ينتظر قراري» افتراضيًّا، ورابط «وافقتُ وتنتظر غيري (N)» (ق٣٢). */
export function ViewSwitch({ view, mineHref, waitingHref }: { view: "mine" | "waiting_others"; mineHref: string; waitingHref: string }) {
  const { waiting } = useQueueCounts();
  if (view === "mine" && waiting === 0) return null;
  return (
    <nav aria-label="عرض الطابور" className="dk-subnav">
      <Link href={mineHref} aria-current={view === "mine" ? "page" : undefined}>
        ينتظر قراري
      </Link>
      <Link href={waitingHref} aria-current={view === "waiting_others" ? "page" : undefined}>
        وافقتُ وتنتظر غيري ({fmt(waiting)})
      </Link>
    </nav>
  );
}

export const NEXT_ITEMS_ID = "dk-next-items";

/** الترقيم بالمفتاح (ق٢٦): «العناصر التالية» بعد آخر مفتاح، و«تحديث الطابور» إن لم يبق شيء بعد القرارات. */
export function QueuePager({
  nextHref,
  firstHref,
  shown,
  total,
  decidedHere,
}: {
  nextHref: string | null;
  firstHref: string | null;
  shown: number;
  total: number;
  decidedHere: number;
}) {
  const router = useRouter();
  if (!nextHref && !firstHref && decidedHere === 0) return null;
  return (
    <nav aria-label="صفحات الطابور" className="dk-pager">
      {firstHref ? (
        <Link href={firstHref} className={btnClass("correct")}>
          أول الطابور
        </Link>
      ) : null}
      {nextHref ? (
        <Link id={NEXT_ITEMS_ID} href={nextHref} className={btnClass("primary")}>
          العناصر التالية
        </Link>
      ) : decidedHere > 0 ? (
        <button id={NEXT_ITEMS_ID} type="button" className={btnClass("correct")} onClick={() => router.refresh()}>
          <RefreshCw size={18} aria-hidden />
          <span>تحديث الطابور</span>
        </button>
      ) : null}
      <span className="dk-meta">
        في هذه الصفحة {fmt(shown)} من أصل {fmt(total)} في هذا العرض
      </span>
    </nav>
  );
}

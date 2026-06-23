"use client";

import { useEffect, useState } from "react";
import { BookOpen, ExternalLink, Loader2 } from "lucide-react";

interface TurathResult {
  id: string;
  bookTitle: string;
  author?: string;
  category?: string;
  snippet?: string;
  page?: string;
  volume?: string;
  url: string;
}

interface TurathResponse {
  ok: boolean;
  results: TurathResult[];
  configured?: boolean;
  note?: string;
}

/**
 * لوحة «مصادر فقهية من تراث» — بحث حيّ في كتب التراث عبر الوسيط /api/turath/search.
 * عميل خفيف: يظهر فقط عند وجود نتائج؛ يسقط بهدوء عند تعذّر الخدمة (لا يكسر الصفحة).
 */
export function TurathSourcesPanel({ query }: { query: string }) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [results, setResults] = useState<TurathResult[]>([]);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setState("idle");
      setResults([]);
      return;
    }
    let cancelled = false;
    setState("loading");
    setNote(null);
    fetch(`/api/turath/search?q=${encodeURIComponent(q)}`)
      .then((r) => r.json() as Promise<TurathResponse>)
      .then((data) => {
        if (cancelled) return;
        setResults(data.results ?? []);
        setNote(data.note ?? null);
        setState(data.ok ? "done" : "error");
      })
      .catch(() => {
        if (cancelled) return;
        setState("error");
        setResults([]);
      });
    return () => {
      cancelled = true;
    };
  }, [query]);

  // لا نعرض شيئاً قبل البحث، أو عند عدم توفّر الخدمة بلا نتائج (سقوط صامت).
  if (state === "idle") return null;
  if (state === "error" && results.length === 0) {
    return (
      <div className="card mt-5 border-r-4" style={{ borderRightColor: "var(--gold)" }}>
        <Header />
        <p className="mt-2 text-sm text-[var(--ink-40)]">
          {note ?? "تعذّر الوصول إلى مكتبة تراث حالياً."}
        </p>
      </div>
    );
  }

  return (
    <div className="card mt-5 border-r-4" style={{ borderRightColor: "var(--gold)" }}>
      <Header />
      {state === "loading" ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-[var(--ink-60)]">
          <Loader2 size={15} className="animate-spin text-[var(--gold)]" /> جارٍ البحث في مكتبة تراث…
        </p>
      ) : results.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--ink-40)]">لا نتائج من تراث لهذه العبارة.</p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm">
          {results.map((r) => (
            <li key={r.id} className="border-t border-[var(--ink-08)] pt-3">
              {/* بطاقة الكتاب: الاسم + المؤلف + القسم + الجزء/الصفحة */}
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <BookOpen size={14} className="text-[var(--gold-dark)]" />
                <span className="t-display font-bold text-[var(--navy)]">{r.bookTitle}</span>
                {r.author ? <span className="text-xs text-[var(--ink-60)]">— {r.author}</span> : null}
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ms-auto inline-flex items-center gap-1 text-xs font-semibold text-[var(--gold-dark)] hover:text-[var(--navy)]"
                >
                  فتح في تراث <ExternalLink size={12} />
                </a>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {r.category ? (
                  <span className="rounded-full border border-[var(--gold-border)] bg-[var(--gold-ghost)] px-2 py-0.5 text-[11px] text-[var(--navy)]">
                    القسم: {r.category}
                  </span>
                ) : null}
                {r.volume ? (
                  <span className="rounded bg-[var(--ink-04)] px-1.5 py-0.5 text-[11px] text-[var(--ink-60)] tabular-nums">
                    ج {r.volume}
                  </span>
                ) : null}
                {r.page ? (
                  <span className="rounded bg-[var(--ink-04)] px-1.5 py-0.5 text-[11px] text-[var(--ink-60)] tabular-nums">
                    ص {r.page}
                  </span>
                ) : null}
              </div>
              {r.snippet ? <p className="mt-1.5 leading-7 text-[var(--ink-80)]">{r.snippet}</p> : null}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[11px] text-[var(--ink-40)]">
        المصدر: مكتبة تراث (turath.io) — تُعرض النتائج للإحالة العلمية مع نسب المصدر.
      </p>
    </div>
  );
}

function Header() {
  return (
    <div className="flex items-center gap-2">
      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--gold-ghost)] px-2.5 py-0.5 text-xs font-semibold text-[var(--gold-dark)]">
        <BookOpen size={12} /> مصادر فقهية من تراث
      </span>
    </div>
  );
}

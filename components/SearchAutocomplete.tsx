"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Search, BookText, TrendingUp, Clock } from "lucide-react";

type Suggestion = { value: string; kind: "system" | "popular" | "recent"; hint?: string };

/**
 * صندوق بحث مع إكمال تلقائي حيّ من /api/legal-search/suggest.
 * يُرسِل النموذج إلى /dashboard/legal-search (GET) محافظًا على سلوك الخادم.
 * متاح بلوحة المفاتيح (سهم أعلى/أسفل، Enter، Esc) ومتوافق مع قارئ الشاشة (combobox).
 */
export function SearchAutocomplete({
  defaultValue = "",
  placeholder = "ابحث في الأنظمة والمواد والأحكام…",
  autoFocus = false,
  className = "",
  action = "/dashboard/legal-search",
}: {
  defaultValue?: string;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
  /** وجهة إرسال النموذج — تُتيح إعادة استخدام الصندوق الموحّد في أكثر من سطح (عام/لوحة). */
  action?: string;
}) {
  const [q, setQ] = useState(defaultValue);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    const term = q.trim();
    // صندوق فارغ وغير مركَّز: لا شيء. فارغ ومركَّز: نجلب سجل البحث الأخير (q فارغ).
    if (term.length < 2 && !open) {
      setItems([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/legal-search/suggest?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        const data = await res.json();
        setItems(Array.isArray(data.suggestions) ? data.suggestions : []);
        setActive(-1);
      } catch {
        /* تجاهل الإلغاء/الخطأ */
      }
    }, 180);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q, open]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const showList = open && items.length > 0;

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showList) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      setQ(items[active].value);
      setOpen(false);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={boxRef} className={`relative ${className}`}>
      <form action={action} role="search">
        <div className="flex flex-wrap items-center gap-2">
          <div
            className="flex flex-1 items-center gap-2 rounded-[var(--r-md)] border border-[var(--ink-20)] bg-ivory px-3 focus-within:border-[var(--gold)] focus-within:ring-2 focus-within:ring-[var(--gold-ghost)]"
            role="combobox"
            aria-expanded={showList}
            aria-haspopup="listbox"
            aria-owns={listId}
          >
            <Search size={18} className="text-[var(--ink-40)]" aria-hidden />
            <input
              name="q"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onKeyDown={onKeyDown}
              placeholder={placeholder}
              autoFocus={autoFocus}
              autoComplete="off"
              aria-label="عبارة البحث"
              aria-autocomplete="list"
              aria-controls={listId}
              aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
              className="h-11 w-full border-0 bg-transparent text-sm text-[var(--ink)] outline-none placeholder:text-[var(--ink-40)]"
            />
          </div>
          <button type="submit" className="btn btn-gold">
            <Search size={16} aria-hidden /> ابحث
          </button>
        </div>
      </form>

      {showList && (
        <ul
          id={listId}
          role="listbox"
          aria-label="اقتراحات البحث"
          className="absolute z-30 mt-1 w-full overflow-hidden rounded-[var(--r-md)] border border-[var(--ink-08)] bg-ivory shadow-[var(--sh-md)]"
        >
          {items.map((s, i) => {
            const Icon = s.kind === "system" ? BookText : s.kind === "recent" ? Clock : TrendingUp;
            return (
              <li
                key={`${s.kind}:${s.value}`}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                className={`flex cursor-pointer items-center gap-2 px-3 py-2 text-sm ${
                  i === active ? "bg-[var(--gold-ghost)] text-[var(--navy)]" : "text-[var(--ink-80)] hover:bg-[var(--ink-04)]"
                }`}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  setQ(s.value);
                  setOpen(false);
                  // أرسل النموذج فورًا عند الاختيار بالفأرة.
                  const form = boxRef.current?.querySelector("form") as HTMLFormElement | null;
                  form?.requestSubmit();
                }}
              >
                <Icon size={15} className="shrink-0 text-[var(--gold)]" aria-hidden />
                <span className="flex-1 truncate">{s.value}</span>
                {s.hint ? <span className="shrink-0 text-xs text-[var(--ink-40)]">{s.hint}</span> : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

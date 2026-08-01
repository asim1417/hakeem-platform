"use client";

// شريط الأوامر الموحّد (⌘K) — المخطط السيادي §18. Command-First UX.
// خفيفٌ ومستقلّ (بلا تبعيات خارجيّة): بحث + تنقّل + مساحات عمل + إجراءات سريعة.
// يُفتح بـ Cmd/Ctrl+K، تنقّل بالأسهم، تنفيذ بـ Enter، إغلاق بـ Esc.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { WORKSPACES } from "@/lib/modules/workspaces/registry";
import { WORKSPACE_STATE_KEY } from "@/lib/modules/workspaces/registry";

type Command = { id: string; title: string; hint?: string; href: string; group: string };

const BASE_COMMANDS: Command[] = [
  { id: "home", title: "الرئيسية", href: "/dashboard", group: "تنقّل" },
  { id: "ask", title: "اسأل حكيم", href: "/dashboard/ask", group: "تنقّل" },
  { id: "review", title: "مركز المراجعة", href: "/dashboard/review", group: "تنقّل" },
  { id: "ja", title: "المعاون القضائيّ", href: "/dashboard/judicial-assistant", group: "تنقّل" },
  { id: "search", title: "البحث القانونيّ", href: "/dashboard/legal-search", group: "تنقّل" },
  { id: "library", title: "المكتبة النظاميّة", href: "/dashboard/legal-core", group: "تنقّل" },
  { id: "sim", title: "القاضي التفاعليّ", href: "/dashboard/simulations", group: "تنقّل" },
  { id: "kg", title: "الرسم المعرفيّ", href: "/dashboard/knowledge-graph", group: "تنقّل" },
  { id: "files", title: "ملفّاتي", href: "/dashboard/files", group: "تنقّل" },
  { id: "governance", title: "الحوكمة المعماريّة", href: "/admin/governance", group: "إدارة" },
  { id: "export", title: "تصدير بياناتي", href: "/api/account/export", group: "إجراءات" },
];

const WORKSPACE_COMMANDS: Command[] = WORKSPACES.map((w) => ({
  id: `ws-${w.id}`,
  title: `مساحة: ${w.labelAr}`,
  hint: w.href,
  href: w.href,
  group: "مساحات العمل",
}));

const ALL: Command[] = [...BASE_COMMANDS, ...WORKSPACE_COMMANDS];

function normalize(s: string): string {
  return s.replace(/[ً-ْـ]/g, "").replace(/[أإآ]/g, "ا").toLowerCase().trim();
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const q = normalize(query);
    if (!q) return ALL;
    return ALL.filter((c) => normalize(c.title).includes(q) || normalize(c.group).includes(q));
  }, [query]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const run = useCallback(
    (cmd: Command) => {
      setOpen(false);
      // حفظ آخر مساحة عمل إن كان أمرًا لمساحة.
      if (cmd.id.startsWith("ws-")) {
        try {
          localStorage.setItem(
            WORKSPACE_STATE_KEY,
            JSON.stringify({ workspaceId: cmd.id.slice(3), lastPath: cmd.href, updatedAt: new Date().toISOString() })
          );
        } catch {
          /* تجاهل */
        }
      }
      if (cmd.href.startsWith("/api/")) window.location.href = cmd.href;
      else router.push(cmd.href);
    },
    [router]
  );

  function onListKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const cmd = results[active];
      if (cmd) run(cmd);
    }
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="شريط الأوامر"
      dir="rtl"
      onClick={() => setOpen(false)}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(14,52,53,0.35)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "12vh",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(640px, 92vw)",
          background: "#FFFcf7",
          borderRadius: 14,
          boxShadow: "0 24px 60px rgba(14,52,53,0.28)",
          overflow: "hidden",
        }}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={onListKey}
          placeholder="ابحث أو اكتب أمرًا… (Esc للإغلاق)"
          aria-label="ابحث أو اكتب أمرًا"
          style={{
            width: "100%",
            padding: "16px 18px",
            border: "none",
            borderBottom: "1px solid rgba(14,52,53,0.12)",
            fontSize: 16,
            background: "transparent",
            outline: "none",
          }}
        />
        <ul role="listbox" aria-label="النتائج" style={{ listStyle: "none", margin: 0, padding: 6, maxHeight: "50vh", overflowY: "auto" }}>
          {results.length === 0 ? (
            <li style={{ padding: "12px 16px", color: "rgba(14,52,53,0.6)", fontSize: 14 }}>لا نتائج.</li>
          ) : (
            results.map((cmd, i) => (
              <li
                key={cmd.id}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => run(cmd)}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 14px",
                  borderRadius: 8,
                  cursor: "pointer",
                  background: i === active ? "#0E3435" : "transparent",
                  color: i === active ? "#FFFcf7" : "#0E3435",
                }}
              >
                <span style={{ fontWeight: 600, fontSize: 14 }}>{cmd.title}</span>
                <span style={{ fontSize: 11, opacity: 0.7 }}>{cmd.group}</span>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}

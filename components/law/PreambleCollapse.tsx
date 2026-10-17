"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { PREAMBLE_COLLAPSE_LINES } from "@/lib/modules/legal-core/law-page-view";

/**
 * طي المقدمة (ع-٤): مطوية إن تجاوزت ١٢ سطرًا من سطر المتن، والمطوي inert فلا يدخله التركيز.
 * تُفتح تلقائيًا بمرساة #preamble-… أو بمطابقة بحث داخلها (حدث law:expand-preamble) أو عند الطباعة.
 */
export function PreambleCollapse({ children, initiallyCollapsed }: { children: ReactNode; initiallyCollapsed: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [needed, setNeeded] = useState(initiallyCollapsed);
  const [collapsed, setCollapsed] = useState(initiallyCollapsed);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const lh = parseFloat(getComputedStyle(el).lineHeight) || 36;
    const full = el.scrollHeight;
    const tooLong = full > PREAMBLE_COLLAPSE_LINES * lh + 4;
    setNeeded(tooLong);
    if (!tooLong) setCollapsed(false);
    const open = () => setCollapsed(false);
    window.addEventListener("law:expand-preamble", open);
    window.addEventListener("beforeprint", open);
    if (/^#preamble/.test(window.location.hash)) open();
    return () => {
      window.removeEventListener("law:expand-preamble", open);
      window.removeEventListener("beforeprint", open);
    };
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (collapsed) el.setAttribute("inert", "");
    else el.removeAttribute("inert");
  }, [collapsed]);

  return (
    <div className="pre">
      <div id="pre-body" ref={ref} className="pre-body" data-collapsed={collapsed ? "" : undefined}>
        {children}
      </div>
      {needed ? (
        <div className="pre-toggle">
          <button type="button" className="lbtn lbtn--outline" aria-expanded={!collapsed} aria-controls="pre-body" onClick={() => setCollapsed((c) => !c)}>
            {collapsed ? "عرض المقدمة كاملة" : "طيّ المقدمة"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

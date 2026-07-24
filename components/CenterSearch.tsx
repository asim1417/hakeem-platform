"use client";

import { useState } from "react";
import { TRADITIONAL_SEARCH_ENABLED } from "@/lib/modules/config/search-visibility";

/**
 * السلوك السابق (احتياطي عند HOME_INLINE_ASK=0):
 * توجيه إلى /dashboard/ask?q=… — لا يُستخدم عند تفعيل التنفيذ المضمّن.
 */
export function CenterSearch() {
  const [mode, setMode] = useState<"ask" | "text">("ask");
  const [q, setQ] = useState("");

  const submit = () => {
    const dest = mode === "ask" || !TRADITIONAL_SEARCH_ENABLED ? "/dashboard/ask" : "/dashboard/legal-search";
    window.location.href = `${dest}?q=${encodeURIComponent(q.trim())}`;
  };

  return (
    <div className="center-search">
      {/* مبدّل نوع البحث يظهر فقط حين يكون البحث التقليديّ ظاهرًا؛ وإلّا فالبحث الذكيّ وحده. */}
      {TRADITIONAL_SEARCH_ENABLED ? (
        <div className="cs-toggle" role="tablist" aria-label="نوع البحث">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "ask"}
            data-active={mode === "ask"}
            onClick={() => setMode("ask")}
          >
            ✦ اسأل حكيم
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "text"}
            data-active={mode === "text"}
            onClick={() => setMode("text")}
          >
            ⌕ البحث النصّي
          </button>
        </div>
      ) : null}
      <div className="cs-box">
        <span aria-hidden="true">⌕</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          aria-label={mode === "ask" ? "اسأل حكيم" : "بحث نصّي"}
          placeholder={
            mode === "ask"
              ? "اطرح واقعتك أو سؤالك القانونيّ..."
              : "ابحث في الأنظمة والمواد والأحكام والمبادئ..."
          }
        />
        <button type="button" onClick={submit}>
          {mode === "ask" ? "اسأل" : "ابحث"}
        </button>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";

// صندوق البحث المركزيّ بخيارين — «اسأل حكيم» (افتراضيّ) و«البحث النصّي».
// عرض الرئيسية فقط؛ لا يمسّ منطق الأوضاع/الوكيل/المصادقة — مجرّد توجيه إلى الوجهتين.
export function CenterSearch() {
  const [mode, setMode] = useState<"ask" | "text">("ask");
  const [q, setQ] = useState("");

  const submit = () => {
    const dest = mode === "ask" ? "/dashboard/ask" : "/dashboard/legal-search";
    window.location.href = `${dest}?q=${encodeURIComponent(q.trim())}`;
  };

  return (
    <div className="center-search">
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

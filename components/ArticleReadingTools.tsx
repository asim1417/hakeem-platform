"use client";

import { useState } from "react";
import { Minus, Plus, BookOpenCheck, Printer, FileDown } from "lucide-react";

/**
 * أدوات القراءة لصفحة المادة: حجم الخط، وضع القراءة (إخفاء العناصر الجانبية
 * للتركيز على النص)، الطباعة/PDF عبر المتصفّح، وتصدير Word بلا اعتماد مكتبة.
 * تعمل على الحاوية `#legal-reading-root` عبر متغيّر CSS وصنف، دون تمرير حالة.
 */
export function ArticleReadingTools({ exportText, exportTitle, citation }: { exportText: string; exportTitle: string; citation: string }) {
  const [scale, setScale] = useState(1);
  const [focus, setFocus] = useState(false);

  function apply(next: number) {
    const v = Math.min(1.8, Math.max(0.85, Number(next.toFixed(2))));
    setScale(v);
    document.getElementById("legal-reading-root")?.style.setProperty("--reading-scale", String(v));
  }

  function toggleFocus() {
    const next = !focus;
    setFocus(next);
    document.getElementById("legal-reading-root")?.classList.toggle("reading-focus", next);
  }

  function exportWord() {
    const safe = exportText.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] as string));
    const html =
      `<html dir="rtl" lang="ar"><head><meta charset="utf-8"></head>` +
      `<body style="font-family:'Times New Roman',serif;line-height:1.9">` +
      `<h2 style="color:#0E3435">${exportTitle}</h2>` +
      `<div style="font-size:16px">${safe.replace(/\n/g, "<br>")}</div>` +
      `<hr><p style="font-size:12px;color:#555">${citation}</p>` +
      `</body></html>`;
    const blob = new Blob(["﻿", html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${exportTitle}.doc`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  const btn = "inline-flex items-center gap-1 rounded-[var(--r-md)] border border-[var(--ink-20)] bg-[var(--paper)] px-2.5 py-1.5 text-xs font-semibold text-[var(--navy)] transition hover:border-[var(--gold)]";

  return (
    <div className="reading-tools flex flex-wrap items-center gap-1.5" role="toolbar" aria-label="أدوات القراءة">
      <button type="button" className={btn} onClick={() => apply(scale - 0.1)} aria-label="تصغير الخط"><Minus size={14} aria-hidden /></button>
      <span className="min-w-[3ch] text-center font-mono-legal text-xs text-[var(--ink-60)] tabular-nums">{Math.round(scale * 100)}%</span>
      <button type="button" className={btn} onClick={() => apply(scale + 0.1)} aria-label="تكبير الخط"><Plus size={14} aria-hidden /></button>
      <button type="button" className={btn} onClick={toggleFocus} aria-pressed={focus} aria-label="وضع القراءة"><BookOpenCheck size={14} aria-hidden /> وضع القراءة</button>
      <button type="button" className={btn} onClick={() => window.print()} aria-label="طباعة أو حفظ PDF"><Printer size={14} aria-hidden /> طباعة / PDF</button>
      <button type="button" className={btn} onClick={exportWord} aria-label="تصدير Word"><FileDown size={14} aria-hidden /> Word</button>
    </div>
  );
}

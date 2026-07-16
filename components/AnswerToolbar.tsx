"use client";

// ─────────────────────────────────────────────────────────────────────────────
// شريط أدوات الإجابة — أيقونات فوق إجابة «اسأل حكيم»: نسخ النصّ (الإضافة ٢).
// عرض فقط — لا يمسّ المحرّك ولا البحث. النصّ المنسوخ نظيف (بلا رموز Markdown)،
// والمراجع تُعرض «(م/رقم المادة)». بناء في الذاكرة، بلا localStorage.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from "react";
import type { AnswerSource } from "./AnswerRenderer";

/** يحوّل Markdown الإجابة إلى نصّ نظيف: يزيل رموز التنسيق ويعرض المراجع «(م/رقم المادة)». */
export function toPlainText(content: string, basis: AnswerSource[] = []): string {
  let t = content || "";
  // مراجع [n] → «(م/رقم المادة)» من المصادر (أو تُترك كما هي إن جُهل الرقم).
  t = t.replace(/\[(\d{1,3})\]/g, (m, n) => {
    const src = basis[Number(n) - 1];
    const num = src?.articleNumber;
    if (num === undefined || num === "") return m;
    return `(م/${typeof num === "number" ? num.toLocaleString("ar-SA") : num})`;
  });
  return t
    .replace(/^#{1,6}\s+/gm, "") // عناوين
    .replace(/\*\*(.*?)\*\*/g, "$1") // غامق
    .replace(/^\s*---\s*$/gm, "") // فواصل
    .replace(/^\s*\|/gm, "") // بداية صفوف الجداول
    .replace(/\|/g, " · ") // فواصل خلايا الجداول
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function AnswerToolbar({
  answer,
  basis = [],
  question,
}: {
  answer: string;
  basis?: AnswerSource[];
  question?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);

  async function copyAnswer() {
    try {
      await navigator.clipboard.writeText(toPlainText(answer, basis));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* تجاهل تعذّر الحافظة */
    }
  }

  async function exportWord() {
    if (exporting) return;
    setExporting(true);
    try {
      // تحميل كسول لمكتبتَي docx/file-saver (تقسيم الحزمة).
      const [{ buildAnswerDocx }, fileSaver] = await Promise.all([import("@/lib/answer-docx"), import("file-saver")]);
      const blob = await buildAnswerDocx({ content: answer, basis, title: question });
      const name = `حكيم-${(question || "إجابة").replace(/[\\/:*?"<>|]/g, "").trim().slice(0, 40) || "إجابة"}.docx`;
      fileSaver.saveAs(blob, name);
    } catch {
      /* تجاهل تعذّر التصدير */
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="ms-auto flex items-center gap-1.5">
      <button
        type="button"
        onClick={copyAnswer}
        title={copied ? "نُسخ ✓" : "نسخ النصّ"}
        aria-label="نسخ نصّ الإجابة"
        className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-[var(--gold-border)] bg-[var(--gold-ghost)] px-2.5 py-1.5 text-xs font-semibold text-[var(--navy)] transition hover:bg-[var(--gold)] hover:text-white"
      >
        {copied ? (
          <span className="text-[var(--emerald)]">نُسخ ✓</span>
        ) : (
          <>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <rect x="9" y="9" width="13" height="13" rx="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            نسخ
          </>
        )}
      </button>
      <button
        type="button"
        onClick={exportWord}
        disabled={exporting}
        title="تصدير Word"
        aria-label="تصدير الإجابة إلى ملفّ Word"
        className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-[var(--gold-border)] bg-[var(--gold-ghost)] px-2.5 py-1.5 text-xs font-semibold text-[var(--navy)] transition hover:bg-[var(--gold)] hover:text-white disabled:opacity-50"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6" />
          <path d="M8 13h8M8 17h5" />
        </svg>
        {exporting ? "جارٍ…" : "Word"}
      </button>
    </div>
  );
}

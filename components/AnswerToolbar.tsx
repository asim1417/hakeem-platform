"use client";

// ─────────────────────────────────────────────────────────────────────────────
// شريط أدوات الإجابة — نسخ · مشاركة · طباعة · تصدير Word. عرض/تصدير فقط (لا يمسّ المحرّك).
// النصّ المنسوخ/المُشارَك نظيف (بلا Markdown)، والمراجع «(م/رقم المادة)». الطباعة تعزل
// الإجابة في إطار مستقلّ منسّق RTL. كل شيء في الذاكرة، بلا localStorage.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from "react";
import type { AnswerSource } from "./AnswerRenderer";

/** يحوّل Markdown الإجابة إلى نصّ نظيف: يزيل رموز التنسيق ويعرض المراجع «(م/رقم المادة)». */
export function toPlainText(content: string, basis: AnswerSource[] = []): string {
  let t = content || "";
  t = t.replace(/\[(\d{1,3})\]/g, (m, n) => {
    const src = basis[Number(n) - 1];
    const num = src?.articleNumber;
    if (num === undefined || num === "") return m;
    return `(م/${typeof num === "number" ? num.toLocaleString("ar-SA") : num})`;
  });
  return t
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/^\s*---\s*$/gm, "")
    .replace(/^\s*\|/gm, "")
    .replace(/\|/g, " · ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function escapeHtml(s: string): string {
  return (s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}

// أنماط طباعة مضمّنة (تعزل الإجابة في إطارها) — تحاكي عرض الصفحة بمعيار قانونيّ.
const PRINT_CSS = `
  @page { margin: 2cm; }
  * { box-sizing: border-box; }
  body { font-family: "Traditional Arabic", "Amiri", serif; color: #1c1c1c; line-height: 1.9; direction: rtl; text-align: right; }
  .doc-head { border-bottom: 2px solid #d4af6e; padding-bottom: .5rem; margin-bottom: 1rem; }
  .doc-brand { color: #9a7b2e; font-weight: 700; }
  .doc-title { color: #1B3A5B; font-size: 20pt; font-weight: 700; margin: .2rem 0; }
  .doc-date { color: #7a7365; font-size: 11pt; }
  .answer-prose h1 { font-size: 18pt; color: #1B3A5B; border-bottom: 2px solid #d4af6e; padding-bottom: .2rem; }
  .answer-prose h2 { font-size: 15pt; color: #1B3A5B; border-right: 4px solid #d4af6e; padding-right: .4rem; }
  .answer-prose h3 { font-size: 13pt; color: #2a4a6b; }
  .answer-prose table { width: 100%; border-collapse: collapse; direction: rtl; margin: .6rem 0; }
  .answer-prose th { background: #1B3A5B; color: #fff; border: 1px solid #c9c4b8; padding: .3rem .5rem; text-align: right; }
  .answer-prose td { border: 1px solid #c9c4b8; padding: .3rem .5rem; text-align: right; }
  .answer-prose .cite-ref { color: #9a7b2e; font-weight: 700; font-size: .8em; text-decoration: none; }
  .answer-prose .cite-ref::before { content: "م/"; opacity: .7; }
  .answer-prose hr { border: none; border-top: 1px solid #d4af6e; margin: .8rem 0; }
`;

/** يطبع HTML الإجابة المُصيَّرة في إطار مستقلّ (iframe) بأنماط طباعة معزولة. */
function printAnswerHtml(innerHTML: string, title: string) {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow?.document;
  if (!doc) {
    iframe.remove();
    return;
  }
  const date = new Date().toLocaleDateString("ar-SA");
  doc.open();
  doc.write(
    `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>${PRINT_CSS}</style></head><body>` +
      `<div class="doc-head"><div class="doc-brand">مكتب أمان</div><div class="doc-title">${escapeHtml(title)}</div><div class="doc-date">التاريخ: ${date}</div></div>` +
      `<div class="answer-prose">${innerHTML}</div></body></html>`
  );
  doc.close();
  const fire = () => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    window.setTimeout(() => iframe.remove(), 1000);
  };
  if (doc.readyState === "complete") window.setTimeout(fire, 200);
  else iframe.onload = () => window.setTimeout(fire, 200);
}

function ToolButton({ onClick, title, label, disabled, children, done }: { onClick: () => void; title: string; label: string; disabled?: boolean; children: React.ReactNode; done?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-[var(--gold-border)] bg-[var(--gold-ghost)] px-2.5 py-1.5 text-xs font-semibold text-[var(--navy)] transition hover:bg-[var(--gold)] hover:text-white disabled:opacity-50"
    >
      {children}
      <span className={done ? "text-[var(--emerald)]" : ""}>{label}</span>
    </button>
  );
}

export function AnswerToolbar({
  answer,
  basis = [],
  question,
  printTargetId,
}: {
  answer: string;
  basis?: AnswerSource[];
  question?: string;
  printTargetId?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const [exporting, setExporting] = useState(false);
  const docTitle = (question || "استشارة قانونية").trim();

  async function copyAnswer() {
    try {
      await navigator.clipboard.writeText(toPlainText(answer, basis));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* تجاهل */
    }
  }

  async function shareAnswer() {
    const text = toPlainText(answer, basis);
    const nav = navigator as Navigator & { share?: (d: { title?: string; text?: string }) => Promise<void> };
    if (typeof nav.share === "function") {
      try {
        await nav.share({ title: `${docTitle} — حكيم`, text });
      } catch {
        /* أُلغيت المشاركة */
      }
      return;
    }
    // سقوط: نسخ للحافظة مع تأكيد «نُسخ للمشاركة».
    try {
      await navigator.clipboard.writeText(text);
      setShared(true);
      window.setTimeout(() => setShared(false), 2000);
    } catch {
      /* تجاهل */
    }
  }

  function printAnswer() {
    const el = printTargetId ? document.getElementById(printTargetId) : null;
    const html = el?.innerHTML ?? escapeHtml(toPlainText(answer, basis)).replace(/\n/g, "<br/>");
    printAnswerHtml(html, docTitle);
  }

  async function exportWord() {
    if (exporting) return;
    setExporting(true);
    try {
      const [{ buildAnswerDocx }, fileSaver] = await Promise.all([import("@/lib/answer-docx"), import("file-saver")]);
      const blob = await buildAnswerDocx({ content: answer, basis, title: question });
      const name = `حكيم-${docTitle.replace(/[\\/:*?"<>|]/g, "").slice(0, 40) || "إجابة"}.docx`;
      fileSaver.saveAs(blob, name);
    } catch {
      /* تجاهل */
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <ToolButton onClick={copyAnswer} title="نسخ النصّ" label={copied ? "نُسخ ✓" : "نسخ"} done={copied}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <rect x="9" y="9" width="13" height="13" rx="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      </ToolButton>

      <ToolButton onClick={shareAnswer} title="مشاركة" label={shared ? "نُسخ ✓" : "مشاركة"} done={shared}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
        </svg>
      </ToolButton>

      <ToolButton onClick={printAnswer} title="طباعة" label="طباعة">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M6 9V2h12v7" />
          <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
          <rect x="6" y="14" width="12" height="8" rx="1" />
        </svg>
      </ToolButton>

      <ToolButton onClick={exportWord} title="تصدير Word" label={exporting ? "جارٍ…" : "Word"} disabled={exporting}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6" />
          <path d="M8 13h8M8 17h5" />
        </svg>
      </ToolButton>
    </div>
  );
}

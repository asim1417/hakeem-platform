"use client";

// ─────────────────────────────────────────────────────────────────────────────
// شريط أدوات الإجابة — نسخ · طباعة · قائمة مشاركة/تصدير (نصّ · Word · PDF · صفحة HTML).
// عرض/تصدير فقط (لا يمسّ المحرّك). ملفات الوورد/PDF/HTML تُشارَك كملفّ (Web Share) حيث يُدعَم،
// وإلا تُنزَّل. كل شيء في الذاكرة، بلا localStorage.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from "react";
import type { AnswerSource } from "./AnswerRenderer";
import { standaloneAnswerHtml, escapeHtml } from "@/lib/answer-html";

/** يحوّل Markdown الإجابة إلى نصّ نظيف: يزيل رموز التنسيق ويعرض المراجع «(م/رقم المادة)». */
export function toPlainText(content: string, basis: AnswerSource[] = []): string {
  let t = content || "";
  t = t.replace(/\[(\d{1,3})\]/g, (m, n) => {
    const num = basis[Number(n) - 1]?.articleNumber;
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

function safeName(title: string, ext: string): string {
  return `حكيم-${(title || "إجابة").replace(/[\\/:*?"<>|]/g, "").trim().slice(0, 40) || "إجابة"}.${ext}`;
}

/** يشارك ملفًّا (Web Share) حيث يُدعَم، وإلا يُنزّله. يتجاهل إلغاء المستخدم دون تنزيل مزدوج. */
async function shareOrDownload(blob: Blob, filename: string, mime: string, title: string) {
  try {
    const file = new File([blob], filename, { type: mime });
    const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean; share?: (d: { files: File[]; title?: string }) => Promise<void> };
    if (nav.canShare && nav.canShare({ files: [file] }) && nav.share) {
      try {
        await nav.share({ files: [file], title });
        return;
      } catch (e) {
        if ((e as Error)?.name === "AbortError") return; // ألغى المستخدم
      }
    }
  } catch {
    /* تجاهل → تنزيل */
  }
  const { saveAs } = await import("file-saver");
  saveAs(blob, filename);
}

function iconWrap(children: React.ReactNode) {
  return children;
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
  const [busy, setBusy] = useState<null | "word" | "pdf" | "html" | "text">(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const docTitle = (question || "استشارة قانونية").trim();

  const renderedHtml = () => (printTargetId ? document.getElementById(printTargetId)?.innerHTML ?? "" : "");
  const dateStr = () => new Date().toLocaleDateString("ar-SA");

  async function copyAnswer() {
    try {
      await navigator.clipboard.writeText(toPlainText(answer, basis));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* تجاهل */
    }
  }

  function printAnswer() {
    const html = renderedHtml() || escapeHtml(toPlainText(answer, basis)).replace(/\n/g, "<br/>");
    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (!doc) {
      iframe.remove();
      return;
    }
    doc.open();
    doc.write(standaloneAnswerHtml(html, docTitle, dateStr()));
    doc.close();
    const fire = () => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      window.setTimeout(() => iframe.remove(), 1000);
    };
    if (doc.readyState === "complete") window.setTimeout(fire, 200);
    else iframe.onload = () => window.setTimeout(fire, 200);
  }

  async function shareText() {
    const text = toPlainText(answer, basis);
    const nav = navigator as Navigator & { share?: (d: { title?: string; text?: string }) => Promise<void> };
    if (typeof nav.share === "function") {
      try {
        await nav.share({ title: `${docTitle} — حكيم`, text });
      } catch {
        /* أُلغيت */
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* تجاهل */
    }
  }

  async function exportWord() {
    setBusy("word");
    try {
      const { buildAnswerDocx } = await import("@/lib/answer-docx");
      const blob = await buildAnswerDocx({ content: answer, basis, title: question });
      await shareOrDownload(blob, safeName(docTitle, "docx"), "application/vnd.openxmlformats-officedocument.wordprocessingml.document", docTitle);
    } catch {
      /* تجاهل */
    } finally {
      setBusy(null);
    }
  }

  async function exportPdf() {
    setBusy("pdf");
    try {
      const el = printTargetId ? document.getElementById(printTargetId) : null;
      if (!el) return;
      const { buildAnswerPdfBlob } = await import("@/lib/answer-pdf");
      const blob = await buildAnswerPdfBlob(el as HTMLElement);
      await shareOrDownload(blob, safeName(docTitle, "pdf"), "application/pdf", docTitle);
    } catch {
      /* تجاهل */
    } finally {
      setBusy(null);
    }
  }

  async function exportHtml() {
    setBusy("html");
    try {
      const html = renderedHtml() || escapeHtml(toPlainText(answer, basis)).replace(/\n/g, "<br/>");
      const blob = new Blob([standaloneAnswerHtml(html, docTitle, dateStr())], { type: "text/html;charset=utf-8" });
      await shareOrDownload(blob, safeName(docTitle, "html"), "text/html", docTitle);
    } catch {
      /* تجاهل */
    } finally {
      setBusy(null);
    }
  }

  const btn =
    "focus-ring inline-flex items-center gap-1.5 rounded-lg border border-[var(--gold-border)] bg-[var(--gold-ghost)] px-2.5 py-1.5 text-xs font-semibold text-[var(--navy)] transition hover:bg-[var(--gold)] hover:text-white disabled:opacity-50";
  const menuItem = "flex w-full items-center gap-2 px-3 py-2 text-right text-xs font-medium text-[var(--ink-80)] transition hover:bg-[var(--gold-ghost)]";

  function runAndClose(fn: () => void | Promise<void>) {
    setMenuOpen(false);
    void fn();
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {/* نسخ */}
      <button type="button" onClick={copyAnswer} title="نسخ النصّ" aria-label="نسخ النصّ" className={btn}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <rect x="9" y="9" width="13" height="13" rx="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
        <span className={copied ? "text-[var(--emerald)]" : ""}>{copied ? "نُسخ ✓" : "نسخ"}</span>
      </button>

      {/* طباعة */}
      <button type="button" onClick={printAnswer} title="طباعة" aria-label="طباعة" className={btn}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M6 9V2h12v7" />
          <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
          <rect x="6" y="14" width="12" height="8" rx="1" />
        </svg>
        <span>طباعة</span>
      </button>

      {/* مشاركة/تصدير (قائمة) */}
      <div className="relative">
        <button type="button" onClick={() => setMenuOpen((v) => !v)} title="مشاركة / تصدير" aria-haspopup="menu" aria-expanded={menuOpen} className={btn}>
          {iconWrap(
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
            </svg>
          )}
          <span>{busy ? "جارٍ…" : "مشاركة"}</span>
          <span aria-hidden className="opacity-70">▾</span>
        </button>

        {menuOpen ? (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} aria-hidden />
            <div
              role="menu"
              className="absolute left-0 z-20 mt-1 min-w-[9.5rem] overflow-hidden rounded-xl border border-[var(--ink-15)] bg-white py-1 shadow-[var(--sh-md)]"
            >
              <button role="menuitem" className={menuItem} onClick={() => runAndClose(shareText)}>
                <span aria-hidden>✍️</span> مشاركة نصّ
              </button>
              <button role="menuitem" className={menuItem} onClick={() => runAndClose(exportWord)} disabled={busy !== null}>
                <span aria-hidden>📄</span> ملفّ Word
              </button>
              <button role="menuitem" className={menuItem} onClick={() => runAndClose(exportPdf)} disabled={busy !== null || !printTargetId}>
                <span aria-hidden>📕</span> ملفّ PDF
              </button>
              <button role="menuitem" className={menuItem} onClick={() => runAndClose(exportHtml)} disabled={busy !== null}>
                <span aria-hidden>🌐</span> صفحة HTML
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

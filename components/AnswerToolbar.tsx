"use client";

// ─────────────────────────────────────────────────────────────────────────────
// شريط أدوات الإجابة — كل الأدوات ظاهرة inline (بلا قائمة تُقتطع): نسخ · مشاركة · طباعة ·
// Word · PDF · HTML. عرض/تصدير فقط. الملفات تُسلَّم بآلية متوافقة مع iOS (Web Share للملفّ،
// وإلا فتح/تنزيل مباشر). PDF يُخرَج من **نفس التنسيق المعروض** (عرض نظيف عالي الدقّة).
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from "react";
import type { AnswerSource } from "./AnswerRenderer";
import { standaloneAnswerHtml, answerHeaderHtml, answerFootHtml, escapeHtml, DOC_CSS } from "@/lib/answer-html";

/** يحوّل Markdown الإجابة إلى نصّ نظيف مع المراجع «(م/رقم المادة)». */
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

/**
 * يسلّم ملفًّا بطريقة متوافقة مع iOS: (١) Web Share للملفّ حيث يُدعَم (يفتح ورقة المشاركة على
 * الآيفون فيُحفَظ/يُرسَل)، (٢) وإلا رابط تنزيل (سطح المكتب/أندرويد)، مع فتح المدوّنة على iOS.
 */
async function deliverFile(blob: Blob, filename: string, mime: string, title: string) {
  const file = new File([blob], filename, { type: mime });
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean; share?: (d: { files: File[]; title?: string }) => Promise<void> };
  if (nav.canShare && nav.canShare({ files: [file] }) && typeof nav.share === "function") {
    try {
      await nav.share({ files: [file], title });
      return;
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return; // ألغى المستخدم
      // غير ذلك → نُكمل للتنزيل
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.target = "_blank"; // iOS يتجاهل download فيفتح الملفّ (مع خيار الحفظ)
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
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
  const [busy, setBusy] = useState<null | "word" | "pdf" | "html">(null);
  const docTitle = (question || "استشارة قانونية").trim();

  const renderedHtml = () => (printTargetId ? document.getElementById(printTargetId)?.innerHTML ?? "" : "");
  const fallbackHtml = () => escapeHtml(toPlainText(answer, basis)).replace(/\n/g, "<br/>");
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
    await copyAnswer();
  }

  // طباعة عبر **المستند الرئيسي** (لا iframe) + @media print يُخفي كل شيء إلا منطقة الطباعة،
  // و window.print() **متزامن داخل النقرة** (يحفظ إيماءة المستخدم فلا يمنعه iOS، ولا يطبع فارغًا).
  function printAnswer() {
    const inner = renderedHtml() || fallbackHtml();
    let area = document.getElementById("hakeem-print-area");
    if (!area) {
      area = document.createElement("div");
      area.id = "hakeem-print-area";
      document.body.appendChild(area);
    }
    area.setAttribute("dir", "rtl");
    area.innerHTML = `${answerHeaderHtml(docTitle, dateStr())}<div class="answer-prose">${inner}</div>${answerFootHtml()}`;
    const cleanup = () => {
      document.body.classList.remove("hakeem-printing");
      if (area) area.innerHTML = "";
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    document.body.classList.add("hakeem-printing");
    window.print(); // متزامن — يحفظ الإيماءة
    window.setTimeout(cleanup, 60000); // احتياط لمتصفّحات لا تُطلق afterprint
  }

  async function exportWord() {
    setBusy("word");
    try {
      const { buildAnswerDocx } = await import("@/lib/answer-docx");
      const blob = await buildAnswerDocx({ content: answer, basis, title: question });
      await deliverFile(blob, safeName(docTitle, "docx"), "application/vnd.openxmlformats-officedocument.wordprocessingml.document", docTitle);
    } catch {
      /* تجاهل */
    } finally {
      setBusy(null);
    }
  }

  async function exportHtml() {
    setBusy("html");
    try {
      const blob = new Blob([standaloneAnswerHtml(renderedHtml() || fallbackHtml(), docTitle, dateStr())], { type: "text/html;charset=utf-8" });
      await deliverFile(blob, safeName(docTitle, "html"), "text/html", docTitle);
    } catch {
      /* تجاهل */
    } finally {
      setBusy(null);
    }
  }

  // PDF من **نفس التنسيق المعروض**: نُصيّر عرضًا نظيفًا (ترويسة + أنماط المستند) خارج الشاشة
  // بعرض ثابت، ونلتقطه بدقّة ×٢ فيخرج أمينًا للتنسيق لا باهتًا.
  async function exportPdf() {
    setBusy("pdf");
    let host: HTMLDivElement | null = null;
    try {
      const inner = renderedHtml() || fallbackHtml();
      host = document.createElement("div");
      host.setAttribute("dir", "rtl");
      host.style.cssText = "position:fixed;left:-100000px;top:0;width:820px;background:#fff;";
      host.innerHTML = `<style>${DOC_CSS}</style><div style="padding:28px;">${answerHeaderHtml(docTitle, dateStr())}<div class="answer-prose">${inner}</div>${answerFootHtml()}</div>`;
      document.body.appendChild(host);
      const { buildAnswerPdfBlob } = await import("@/lib/answer-pdf");
      const blob = await buildAnswerPdfBlob(host);
      await deliverFile(blob, safeName(docTitle, "pdf"), "application/pdf", docTitle);
    } catch {
      /* تجاهل */
    } finally {
      host?.remove();
      setBusy(null);
    }
  }

  const btn =
    "focus-ring inline-flex items-center gap-1.5 rounded-lg border-2 border-[var(--gold)] bg-white px-2.5 py-1.5 text-xs font-bold text-[var(--navy)] shadow-[var(--sh-xs)] transition hover:bg-[var(--navy)] hover:border-[var(--navy)] hover:text-white disabled:opacity-50";
  const ico = { width: 15, height: 15, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2.2, "aria-hidden": true } as const;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button type="button" onClick={copyAnswer} title="نسخ النصّ" aria-label="نسخ النصّ" className={btn}>
        <svg {...ico}>
          <rect x="9" y="9" width="13" height="13" rx="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
        <span className={copied ? "text-[var(--emerald)]" : ""}>{copied ? "نُسخ ✓" : "نسخ"}</span>
      </button>

      <button type="button" onClick={shareText} title="مشاركة نصّ" aria-label="مشاركة نصّ" className={btn}>
        <svg {...ico}>
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
        </svg>
        مشاركة
      </button>

      <button type="button" onClick={printAnswer} title="طباعة" aria-label="طباعة" className={btn}>
        <svg {...ico}>
          <path d="M6 9V2h12v7" />
          <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
          <rect x="6" y="14" width="12" height="8" rx="1" />
        </svg>
        طباعة
      </button>

      <button type="button" onClick={exportWord} disabled={busy !== null} title="تصدير Word" aria-label="تصدير Word" className={btn}>
        <svg {...ico}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6M8 13h8M8 17h5" />
        </svg>
        {busy === "word" ? "جارٍ…" : "Word"}
      </button>

      <button type="button" onClick={exportPdf} disabled={busy !== null || !printTargetId} title="تصدير PDF" aria-label="تصدير PDF" className={btn}>
        <svg {...ico}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6" />
          <path d="M9 13h1.5a1.5 1.5 0 0 1 0 3H9zM9 13v6" />
        </svg>
        {busy === "pdf" ? "جارٍ…" : "PDF"}
      </button>

      <button type="button" onClick={exportHtml} disabled={busy !== null} title="تصدير صفحة HTML" aria-label="تصدير صفحة HTML" className={btn}>
        <svg {...ico}>
          <path d="M4 7l-2 5 2 5M20 7l2 5-2 5M14 4l-4 16" />
        </svg>
        {busy === "html" ? "جارٍ…" : "HTML"}
      </button>
    </div>
  );
}

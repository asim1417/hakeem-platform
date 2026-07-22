// ─────────────────────────────────────────────────────────────────────────────
// تصديرٌ فاخرٌ لمخرجات المعاون القضائيّ إلى PDF (عبر الطباعة) وإلى Word (‎.doc‏).
// يلتزم معيار التحرير العربيّ: RTL كامل، خط Traditional Arabic، تدرّج عناوين، جداول
// تبدأ من اليمين برؤوسٍ داكنة، صناديق تنبيه، ترويسة وتذييل، صفحة A4 بهوامش عربيّة.
// عميلٌ بحت (المتصفّح يُحسِن تشكيل العربيّة) — بلا اعتماد على الخادم.
// ─────────────────────────────────────────────────────────────────────────────

/** ورقة الأنماط المضمّنة — تُعيد تنسيق عناصر المخرَج (answer-prose / الجداول / المصادر) وثيقةً فاخرة. */
const DOC_CSS = `
  @page { size: A4; margin: 3cm 2.5cm 2cm 3.5cm; }
  * { box-sizing: border-box; }
  body {
    font-family: "Traditional Arabic", "Simplified Arabic", "Amiri", serif;
    font-size: 18pt; line-height: 1.7; color: #1b2a29;
    direction: rtl; text-align: justify; margin: 0; background: #fff;
  }
  /* إخفاء عناصر التفاعل غير المطبوعة */
  .ja-result__bar, .ja-live__meter, .ja-stream-caret, .ja-summary__stamp,
  .ja-draft__gen, .ja-badge, svg { display: none !important; }

  /* الترويسة */
  .doc-letterhead {
    display: flex; align-items: center; justify-content: space-between;
    border-bottom: 2px solid #a67c34; padding-bottom: 10px; margin-bottom: 18px;
  }
  .doc-letterhead__brand { font-size: 20pt; font-weight: bold; color: #26433c; }
  .doc-letterhead__sub { font-size: 13pt; color: #6a6250; }

  /* شريط الإشعار (مسودّة مؤصَّلة…) */
  .ja-summary__banner {
    font-size: 13pt; color: #5a5040; background: #faf7f0;
    border: 1px solid #e7ddc7; border-radius: 6px; padding: 8px 12px; margin-bottom: 16px;
  }
  .ja-summary__banner--blocked { background: #fbeeee; border-color: #e6c9c9; color: #7a3a3a; }

  /* العنوان الرئيس للوثيقة */
  .ja-summary__head { margin-bottom: 6px; }
  .ja-summary__head h3 { font-size: 24pt; font-weight: bold; color: #1b2a29; margin: 0 0 4px; }
  .ja-action__id { font-size: 13pt; color: #a67c34; font-weight: normal; }

  /* متن التحليل */
  .answer-prose, .ja-summary__body { font-size: 18pt; line-height: 1.75; }
  .ans-h1, h1 { font-size: 24pt; font-weight: bold; color: #1b2a29; margin: 18px 0 8px; }
  .ans-h2, h2 {
    font-size: 20pt; font-weight: bold; color: #26433c;
    border-right: 5px solid #a67c34; padding-right: 12px; margin: 20px 0 10px;
  }
  .ans-h3, h3 { font-size: 18pt; font-weight: bold; color: #26433c; margin: 14px 0 6px; }
  p { margin: 0 0 8px; }
  ul, ol { padding-right: 26px; margin: 6px 0; }
  li { margin: 0 0 5px; }
  strong, b { font-weight: bold; color: #14201f; }

  /* الاقتباسات وصناديق التنبيه */
  blockquote {
    border-right: 4px solid #a67c34; background: #f7f3ea;
    padding: 10px 14px; margin: 12px 0; border-radius: 0 6px 6px 0; color: #3a352c;
  }

  /* الجداول — تبدأ من اليمين، رؤوسٌ داكنة غامقة */
  table { border-collapse: collapse; width: 100%; direction: rtl; margin: 12px 0; font-size: 16pt; }
  th {
    background: #26433c; color: #fff; font-weight: bold;
    text-align: right; padding: 8px 10px; border: 1px solid #26433c;
  }
  td { border: 1px solid #d9d2c2; padding: 8px 10px; text-align: right; vertical-align: top; }
  tr:nth-child(even) td { background: #faf8f3; }

  /* الأساس النظاميّ والسوابق */
  .ja-sources { margin-top: 18px; page-break-inside: avoid; }
  .ja-sources h4 { font-size: 16pt; font-weight: bold; color: #26433c; border-bottom: 2px solid #a67c34; padding-bottom: 4px; margin: 0 0 8px; }
  .ja-sources ul { list-style: none; padding: 0; }
  .ja-sources li { margin: 0 0 8px; padding-right: 10px; border-right: 2px solid #e7ddc7; }
  .ja-src__law { font-weight: bold; color: #26433c; display: block; }
  .ja-src__quote { display: block; color: #3a352c; font-size: 14pt; }
  .ja-sources__empty { color: #8a8270; }

  /* مشروع الحكم — الأقسام */
  .ja-draft__sec { margin: 0 0 12px; page-break-inside: avoid; }
  .ja-draft__sec h4 { font-size: 18pt; font-weight: bold; color: #26433c; margin: 0 0 4px; }

  /* التذييل */
  .doc-footer {
    margin-top: 26px; border-top: 1px solid #d9d2c2; padding-top: 10px;
    font-size: 12pt; color: #6a6250; display: flex; justify-content: space-between; gap: 12px;
  }
  .doc-footer__note { font-style: normal; }
`;

/** ترويسة Word (فضاءات الأسماء) — تُعرَّف الوثيقة كملفّ Word مع اتّجاهٍ عربيّ. */
const WORD_NS =
  "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40' dir='rtl' lang='ar'>";

const TODAY_LABEL = (): string => {
  const d = new Date();
  const two = (n: number) => String(n).padStart(2, "0");
  return `${two(d.getDate())}/${two(d.getMonth() + 1)}/${d.getFullYear()}م`;
};

/** يُهيّئ متن المخرَج للتصدير: يضبط اتّجاه الجداول، ويضيف حدودها لـ Word. */
function prepareBody(rawHtml: string, forWord: boolean): string {
  if (typeof window === "undefined" || typeof DOMParser === "undefined") return rawHtml;
  try {
    const doc = new DOMParser().parseFromString(`<div id="__root">${rawHtml}</div>`, "text/html");
    doc.querySelectorAll("table").forEach((t) => {
      t.setAttribute("dir", "rtl");
      if (forWord) {
        t.setAttribute("border", "1");
        t.setAttribute("cellspacing", "0");
        t.setAttribute("cellpadding", "6");
      }
    });
    const root = doc.getElementById("__root");
    return root ? root.innerHTML : rawHtml;
  } catch {
    return rawHtml;
  }
}

export interface ExportDocOptions {
  /** عنوان الوثيقة (يظهر في الترويسة الفرعيّة وشريط العنوان). */
  title: string;
  /** معرّف الخدمة (JS-0xx). */
  serviceId: string;
  /** متن المخرَج كـ HTML مُصاغ (يُلتقَط من العرض الحيّ). */
  bodyHtml: string;
}

/** يبني وثيقة HTML فاخرة قائمة بذاتها (أنماطٌ مضمّنة) — للطباعة PDF أو للحفظ Word. */
export function buildExportHtml(opts: ExportDocOptions, forWord = false): string {
  const body = prepareBody(opts.bodyHtml, forWord);
  const head = `<meta charset="utf-8"><title>${escapeHtml(opts.title)}</title><style>${DOC_CSS}</style>`;
  const letterhead = `
    <div class="doc-letterhead">
      <div class="doc-letterhead__brand">منصّة حكيم — المعاون القضائيّ</div>
      <div class="doc-letterhead__sub">${escapeHtml(opts.serviceId)} · ${TODAY_LABEL()}</div>
    </div>`;
  const footer = `
    <div class="doc-footer">
      <span class="doc-footer__note">مسودّةٌ مؤصَّلةٌ بمواد النواة — تخضع لمراجعة القاضي واعتماده، ولا تُعدّ حكمًا نهائيًّا.</span>
      <span>منصّة حكيم</span>
    </div>`;
  const inner = `${letterhead}${body}${footer}`;
  const htmlOpen = forWord ? WORD_NS : `<html dir="rtl" lang="ar">`;
  return `<!DOCTYPE html>${htmlOpen}<head>${head}</head><body>${inner}</body></html>`;
}

/** يفتح نافذة طباعةٍ بالوثيقة الفاخرة → «حفظ كـ PDF» (المتصفّح يُحسِن العربيّة). */
export function exportPdf(opts: ExportDocOptions): void {
  const html = buildExportHtml(opts, false);
  const w = window.open("", "_blank", "width=920,height=1200");
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  // مهلةٌ قصيرة لريثما تُحمَّل الخطوط ويُرتَّب التخطيط قبل استدعاء الطباعة.
  setTimeout(() => { try { w.print(); } catch { /* المستخدم يطبع يدويًّا */ } }, 600);
}

/** ينزّل نسخة Word (‎.doc‏ بصيغة HTML) — يفتحها Word بكامل التنسيق العربيّ. */
export function exportWord(opts: ExportDocOptions): void {
  const html = buildExportHtml(opts, true);
  const blob = new Blob(["﻿", html], { type: "application/msword;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${sanitizeName(opts.serviceId + "-" + opts.title)}.doc`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}

function sanitizeName(s: string): string {
  return s.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "_").slice(0, 80) || "hakeem-doc";
}

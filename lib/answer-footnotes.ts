// ─────────────────────────────────────────────────────────────────────────────
// بناء قائمة «الحواشي (الأساس النظاميّ)» أسفل الدراسة — يربط رقم الهامش [n] في المتن بنصّ
// المادة النظاميّة. مصدرٌ واحدٌ لكلّ صيغ التصدير (نصّ · HTML) كي تتطابق الطباعة/PDF/النسخ مع
// العرض على الشاشة. عرض/تصدير فقط — لا يمسّ المحرّك ولا البحث.
// ─────────────────────────────────────────────────────────────────────────────

export interface FootnoteSource {
  articleNumber?: number | string;
  systemName?: string;
  articleTitle?: string;
  quote?: string;
  status?: string | null;
}

function toArabicDigits(n: number): string {
  return n.toLocaleString("ar-SA");
}

/** مرجع الهامش: «النظام · المادة رقم — العنوان» (أو «النظام · الديباجة» للرقم صفر). */
function refLabel(s: FootnoteSource): string {
  const sys = s.systemName || "مصدر";
  const hasNum = s.articleNumber !== undefined && s.articleNumber !== "";
  const isPreamble = Number(s.articleNumber) === 0;
  const unit = isPreamble
    ? "الديباجة"
    : hasNum
      ? `المادة ${typeof s.articleNumber === "number" ? toArabicDigits(s.articleNumber) : String(s.articleNumber)}`
      : "";
  const head = unit ? `${sys} · ${unit}` : sys;
  // عنوان الديباجة «الديباجة» لا يُكرَّر بعد الوحدة نفسها.
  return s.articleTitle && !(isPreamble && s.articleTitle === "الديباجة") ? `${head} — ${s.articleTitle}` : head;
}

const HTML_ESCAPE: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
function esc(s: string): string {
  return (s || "").replace(/[&<>"']/g, (c) => HTML_ESCAPE[c]);
}

/** هل تستحقّ المصادر عرض قائمة حواشٍ؟ (على الأقلّ مصدرٌ واحد). */
export function hasFootnotes(basis: FootnoteSource[] | undefined | null): boolean {
  return Array.isArray(basis) && basis.length > 0;
}

/** قائمة الحواشي نصًّا صِرفًا (للنسخ/المشاركة/Word النصّي). */
export function footnotesText(basis: FootnoteSource[] | undefined | null): string {
  if (!hasFootnotes(basis)) return "";
  const lines = basis!.map((s, i) => {
    const marker = `[${toArabicDigits(i + 1)}]`;
    const quote = (s.quote || "").trim();
    return quote ? `${marker} ${refLabel(s)}: «${quote}»` : `${marker} ${refLabel(s)}`;
  });
  return `\n\n——— الحواشي (الأساس النظاميّ) ———\n${lines.join("\n")}`;
}

/** قائمة الحواشي HTML — أرقامٌ بمراسٍ id=cite-fn-{n} كي يقفز إليها هامش المتن عند الطباعة/HTML. */
export function footnotesHtml(basis: FootnoteSource[] | undefined | null): string {
  if (!hasFootnotes(basis)) return "";
  const items = basis!
    .map((s, i) => {
      const n = toArabicDigits(i + 1);
      const quote = (s.quote || "").trim();
      const quoteHtml = quote ? `<p class="fn-quote">«${esc(quote)}»</p>` : "";
      return `<li class="fn-item" id="cite-fn-${i + 1}"><span class="fn-num">${n}</span><div class="fn-body"><p class="fn-ref">${esc(refLabel(s))}</p>${quoteHtml}</div></li>`;
    })
    .join("");
  return `<section class="answer-footnotes" aria-label="الحواشي والأساس النظاميّ"><h3 class="fn-title">الحواشي — الأساس النظاميّ من النواة</h3><ol class="fn-list">${items}</ol></section>`;
}

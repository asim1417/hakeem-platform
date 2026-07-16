// ─────────────────────────────────────────────────────────────────────────────
// بناء صفحة HTML مستقلّة للإجابة (للطباعة/التصدير/المشاركة). RTL كامل بأنماط مضمّنة
// تحاكي عرض المنصّة القانونيّ. عرض/تصدير فقط — لا يمسّ المحرّك.
// ─────────────────────────────────────────────────────────────────────────────

export function escapeHtml(s: string): string {
  return (s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}

/** الأنماط المضمّنة للإجابة المستقلّة (طباعة/HTML) — نيليّ/ذهبيّ، جداول حقيقية، مراجع «م/n». */
export const DOC_CSS = `
  @page { margin: 2cm; }
  * { box-sizing: border-box; }
  body { font-family: "Traditional Arabic", "Amiri", "Segoe UI", serif; color: #1c1c1c; line-height: 1.9;
    direction: rtl; text-align: right; max-width: 820px; margin: 0 auto; padding: 24px; background: #fff; }
  .doc-head { border-bottom: 2px solid #d4af6e; padding-bottom: .5rem; margin-bottom: 1.2rem; }
  .doc-brand { color: #9a7b2e; font-weight: 700; letter-spacing: .5px; }
  .doc-title { color: #1B3A5B; font-size: 22px; font-weight: 700; margin: .2rem 0; }
  .doc-date { color: #7a7365; font-size: 13px; }
  .answer-prose h1 { font-size: 20px; color: #1B3A5B; border-bottom: 2px solid #d4af6e; padding-bottom: .25rem; margin: 1.2rem 0 .7rem; }
  .answer-prose h2 { font-size: 17px; color: #1B3A5B; border-right: 4px solid #d4af6e; padding-right: .5rem; margin: 1.1rem 0 .6rem; }
  .answer-prose h3 { font-size: 15px; color: #2a4a6b; margin: .9rem 0 .5rem; }
  .answer-prose p { margin: .5rem 0; }
  .answer-prose ul, .answer-prose ol { margin: .5rem 1.4rem .5rem 0; }
  .answer-prose li { margin: .3rem 0; }
  .answer-prose table { width: 100%; border-collapse: collapse; direction: rtl; margin: .8rem 0; font-size: 14px; }
  .answer-prose th { background: #1B3A5B; color: #fff; border: 1px solid #c9c4b8; padding: .4rem .6rem; text-align: right; }
  .answer-prose td { border: 1px solid #c9c4b8; padding: .4rem .6rem; text-align: right; vertical-align: top; }
  .answer-prose tr:nth-child(even) td { background: #f7f5f0; }
  .answer-prose .cite-ref { color: #9a7b2e; font-weight: 700; font-size: .78em; text-decoration: none;
    background: #f5ecd8; border: 1px solid rgba(212,175,110,.4); border-radius: 5px; padding: 0 .3em; vertical-align: super; }
  .answer-prose .cite-ref::before { content: "م/"; opacity: .7; }
  .answer-prose hr { border: none; border-top: 1px solid #d4af6e; margin: 1rem 0; }
  .doc-foot { margin-top: 1.5rem; border-top: 1px solid #e6e1d6; padding-top: .6rem; color: #9a958a; font-size: 11px; }
`;

/** يبني صفحة HTML كاملة مستقلّة من HTML الإجابة المُصيَّرة. */
export function standaloneAnswerHtml(innerHTML: string, title: string, dateStr: string): string {
  const t = escapeHtml(title || "استشارة قانونية");
  return (
    `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1"><title>${t}</title>` +
    `<style>${DOC_CSS}</style></head><body>` +
    `<div class="doc-head"><div class="doc-brand">مكتب أمان</div><div class="doc-title">${t}</div><div class="doc-date">التاريخ: ${escapeHtml(dateStr)}</div></div>` +
    `<div class="answer-prose">${innerHTML}</div>` +
    `<div class="doc-foot">مُولَّد من منصّة حكيم — مخرجات مساعدة وتعليمية، وليست رأيًا قانونيًّا نهائيًّا.</div>` +
    `</body></html>`
  );
}

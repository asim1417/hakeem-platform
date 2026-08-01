/**
 * اختيار صفحات لمسار read_attachment — حتمي وبسيط (بلا بحث هجين).
 */
import type { DocumentPageResult } from "@/lib/modules/attachments/extraction-provenance";

export type PageRangeInput = { from?: number; to?: number };

export type ReadPageItem = {
  pageNumber: number | null;
  text: string;
  status: string;
  confidence?: number | null;
  warning?: string | null;
};

export type SelectPagesResult = {
  ok: boolean;
  code?: string;
  message?: string;
  items: ReadPageItem[];
  usedPageNumbers: number[];
  /** true عندما لا توجد بنية صفحات ونستخدم النص المجمّع */
  textFallback: boolean;
  truncated: boolean;
};

const DEFAULT_MAX = 120_000;

function scoreHint(text: string, hint: string): number {
  const h = hint.trim().toLowerCase();
  if (!h) return 0;
  const t = text.toLowerCase();
  let score = 0;
  for (const token of h.split(/\s+/).filter((x) => x.length >= 2)) {
    if (t.includes(token)) score += 1;
  }
  return score;
}

export function validatePageRange(
  range: PageRangeInput | undefined,
  pageCount: number
): { ok: true; from: number; to: number } | { ok: false; code: string; message: string } {
  if (!range || (range.from == null && range.to == null)) {
    return { ok: true, from: 1, to: Math.max(1, pageCount) };
  }
  const from = range.from ?? 1;
  const to = range.to ?? pageCount;
  if (!Number.isInteger(from) || !Number.isInteger(to)) {
    return { ok: false, code: "INVALID_PAGE_RANGE", message: "from/to يجب أن يكونا عددين صحيحين." };
  }
  if (from < 1 || to < 1) {
    return { ok: false, code: "INVALID_PAGE_RANGE", message: "أرقام الصفحات تبدأ من 1." };
  }
  if (from > to) {
    return { ok: false, code: "INVALID_PAGE_RANGE", message: "from يجب أن يكون ≤ to." };
  }
  if (pageCount > 0 && (from > pageCount || to > pageCount)) {
    return {
      ok: false,
      code: "PAGE_OUT_OF_RANGE",
      message: `النطاق خارج المستند (1–${pageCount}).`,
    };
  }
  return { ok: true, from, to };
}

/**
 * يختار صفحات/مقاطع للقراءة مع احترام pageRange وqueryHint الحتمي.
 * لا يدّعي رقم صفحة إن لم تتوفر بنية pages.
 */
export function selectAttachmentPagesForRead(input: {
  pages?: DocumentPageResult[] | null;
  fullText: string;
  pageRange?: PageRangeInput;
  queryHint?: string;
  maxChars?: number;
}): SelectPagesResult {
  const maxChars = input.maxChars ?? DEFAULT_MAX;
  const pages = Array.isArray(input.pages) ? [...input.pages].sort((a, b) => a.pageNumber - b.pageNumber) : [];
  const hint = String(input.queryHint ?? "").trim();

  if (!pages.length) {
    let text = String(input.fullText ?? "");
    let truncated = false;
    if (hint && text) {
      // اختيار حتمي لمقطع يحتوي التلميح إن وُجد
      const idx = text.toLowerCase().indexOf(hint.toLowerCase().split(/\s+/)[0] || hint.toLowerCase());
      if (idx >= 0) {
        const start = Math.max(0, idx - 400);
        text = text.slice(start, start + maxChars);
        truncated = start > 0 || text.length < String(input.fullText ?? "").length;
      }
    }
    if (text.length > maxChars) {
      text = text.slice(0, maxChars);
      truncated = true;
    }
    return {
      ok: true,
      items: [
        {
          pageNumber: null,
          text,
          status: text ? "READY" : "EMPTY",
          warning: "NO_PAGE_STRUCTURE_FALLBACK_FULL_TEXT",
        },
      ],
      usedPageNumbers: [],
      textFallback: true,
      truncated,
    };
  }

  const range = validatePageRange(input.pageRange, pages.length ? Math.max(...pages.map((p) => p.pageNumber)) : 0);
  if (!range.ok) {
    return {
      ok: false,
      code: range.code,
      message: range.message,
      items: [],
      usedPageNumbers: [],
      textFallback: false,
      truncated: false,
    };
  }

  let selected = pages.filter((p) => p.pageNumber >= range.from && p.pageNumber <= range.to);

  if (hint && selected.length > 1) {
    selected = [...selected].sort((a, b) => scoreHint(b.text, hint) - scoreHint(a.text, hint));
    // أبقِ الصفحات ذات النقاط الأعلى ثم أعد الترتيب الرقمي للعرض
    const top = selected.filter((p) => scoreHint(p.text, hint) > 0);
    selected = (top.length ? top : selected).sort((a, b) => a.pageNumber - b.pageNumber);
  }

  const items: ReadPageItem[] = [];
  let budget = maxChars;
  let truncated = false;
  const used: number[] = [];

  for (const p of selected) {
    const st = p.status === "failed" ? "FAILED" : p.status === "partial" ? "PARTIAL" : "READY";
    if (st === "FAILED") {
      items.push({
        pageNumber: p.pageNumber,
        text: "",
        status: "FAILED",
        confidence: p.confidence ?? null,
        warning: "PAGE_FAILED",
      });
      used.push(p.pageNumber);
      continue;
    }
    let text = p.text || "";
    if (text.length > budget) {
      text = text.slice(0, Math.max(0, budget));
      truncated = true;
    }
    budget -= text.length;
    items.push({
      pageNumber: p.pageNumber,
      text,
      status: st,
      confidence: p.confidence ?? null,
      warning: st === "PARTIAL" ? "PARTIAL_PAGE" : truncated && !text ? "TRUNCATED" : null,
    });
    used.push(p.pageNumber);
    if (budget <= 0) {
      truncated = true;
      break;
    }
  }

  return {
    ok: true,
    items,
    usedPageNumbers: used,
    textFallback: false,
    truncated,
  };
}

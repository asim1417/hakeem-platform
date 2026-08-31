/**
 * توحيد الاستشهاد القانوني واستشهاد صفحات المرفقات.
 * لا يستبدل محرّكات التحقق القائمة — يوحّد شكل العرض والـ basis.
 */
import type { RetrievedSource } from "@/lib/modules/hakeem-agent/tools";
import type { Citation } from "@/lib/modules/citations/citation-engine";
import type { VerifiedCitation } from "@/lib/modules/agents/thinking/verifier";

export type UnifiedCitationKind =
  | "legal-article"
  | "legal-ruling"
  | "legal-principle"
  | "attachment-page"
  | "attachment-document";

export type UnifiedCitation = {
  kind: UnifiedCitationKind;
  /** رقم حاشية العرض [n] إن وُجد */
  cite?: number;
  /** معرّف ثابت في القاعدة أو المرفق */
  sourceId: string;
  /** المرجع العربي الرسمي للعرض */
  label: string;
  /** مقتطف قصير — بلا نص كامل في التدقيق */
  snippet?: string;
  confidence?: number;
  /** صفحات المرفق فقط */
  attachmentId?: string;
  pageNumber?: number | null;
  pageStatus?: string;
  verified?: boolean;
};

/** استشهاد مادة/حكم من محرّك الاستشهاد العام */
export function fromEngineCitation(c: Citation, cite?: number): UnifiedCitation {
  const kind: UnifiedCitationKind =
    c.sourceType === "article"
      ? "legal-article"
      : c.sourceType === "ruling"
        ? "legal-ruling"
        : "legal-principle";
  return {
    kind,
    cite,
    sourceId: c.sourceId,
    label: c.reference,
    confidence: c.confidence,
    verified: true,
  };
}

/** استشهاد من مصدر وكيل Ask (RetrievedSource) */
export function fromRetrievedSource(s: RetrievedSource): UnifiedCitation {
  return {
    kind: "legal-article",
    cite: s.cite,
    sourceId: s.sourceId,
    label: `${s.systemName} — المادة (${s.articleNumber})${s.articleTitle ? ` — ${s.articleTitle}` : ""}`,
    snippet: s.snippet?.slice(0, 280),
    verified: true,
  };
}

/** استشهاد من تحقق المنسّق */
export function fromVerifiedCitation(v: VerifiedCitation, cite?: number): UnifiedCitation {
  return {
    kind: "legal-article",
    cite,
    sourceId: v.articleId ?? `${v.systemName}:${v.articleNumber}`,
    label: v.citationLabel,
    snippet: v.quote?.slice(0, 280),
    verified: true,
    confidence: v.certainty === "high" ? 1 : 0.7,
  };
}

/**
 * استشهاد صفحة مرفق — لا يدّعي رقم صفحة إن كانت البنية غير متاحة.
 */
export function formatAttachmentPageCitation(input: {
  attachmentId: string;
  fileName: string;
  pageNumber: number | null;
  pageStatus?: string;
  textFallback?: boolean;
  cite?: number;
  snippet?: string;
}): UnifiedCitation {
  const hasPage = typeof input.pageNumber === "number" && input.pageNumber >= 1 && !input.textFallback;
  const label = hasPage
    ? `مرفق «${input.fileName}» — الصفحة (${input.pageNumber})`
    : `مرفق «${input.fileName}» — نص مجمّع (بلا بنية صفحات)`;
  return {
    kind: hasPage ? "attachment-page" : "attachment-document",
    cite: input.cite,
    sourceId: hasPage ? `${input.attachmentId}:p${input.pageNumber}` : input.attachmentId,
    attachmentId: input.attachmentId,
    pageNumber: hasPage ? input.pageNumber : null,
    pageStatus: input.pageStatus,
    label,
    snippet: input.snippet?.slice(0, 280),
    verified: false, // إسناد مرفق المستخدم — ليس نواة نظامية
  };
}

/** يبني قائمة موحّدة من مصادر الوكيل + صفحات مقروءة */
export function buildUnifiedCitationSet(input: {
  legal?: RetrievedSource[];
  attachmentReads?: Array<{
    attachmentId: string;
    fileName: string;
    pageNumbers: number[];
    textFallback: boolean;
    snippets?: string[];
  }>;
}): UnifiedCitation[] {
  const out: UnifiedCitation[] = [];
  for (const s of input.legal ?? []) {
    out.push(fromRetrievedSource(s));
  }
  let nextCite = (input.legal?.length ?? 0) + 1;
  for (const a of input.attachmentReads ?? []) {
    if (a.textFallback || !a.pageNumbers.length) {
      out.push(
        formatAttachmentPageCitation({
          attachmentId: a.attachmentId,
          fileName: a.fileName,
          pageNumber: null,
          textFallback: true,
          cite: nextCite++,
          snippet: a.snippets?.[0],
        })
      );
      continue;
    }
    for (let i = 0; i < a.pageNumbers.length; i++) {
      out.push(
        formatAttachmentPageCitation({
          attachmentId: a.attachmentId,
          fileName: a.fileName,
          pageNumber: a.pageNumbers[i],
          cite: nextCite++,
          snippet: a.snippets?.[i],
        })
      );
    }
  }
  return out;
}

/** نص حاشية Markdown أسفل الإجابة */
export function renderUnifiedCitationsMarkdown(citations: UnifiedCitation[]): string {
  if (!citations.length) return "";
  const lines = citations.map((c) => {
    const n = c.cite != null ? `[${c.cite}] ` : "";
    const tag =
      c.kind === "attachment-page" || c.kind === "attachment-document"
        ? "مرفق"
        : c.kind === "legal-ruling"
          ? "حكم"
          : c.kind === "legal-principle"
            ? "مبدأ"
            : "نظام";
    return `${n}(${tag}) ${c.label}`;
  });
  return ["", "---", "### المراجع", ...lines].join("\n");
}

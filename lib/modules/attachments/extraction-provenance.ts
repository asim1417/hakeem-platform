/**
 * مصدر نتيجة الاستخراج + قواعد السباق بين المتصفح وdoc-node.
 */
export type ExtractionProvenance =
  | "SERVER_LOCAL"
  | "SERVER_GEMINI"
  | "SERVER_QARI"
  | "CLIENT_PREVIEW"
  | "CLIENT_FALLBACK";

export type DocumentPageResult = {
  pageNumber: number;
  text: string;
  confidence?: number;
  status: "ready" | "partial" | "failed";
  extractionKind?: string;
  warnings?: string[];
};

export type VerificationStatus = "SERVER_VERIFIED" | "CLIENT_UNVERIFIED" | "PREVIEW_ONLY";

export const ACTIVE_SERVER_JOB_STATUSES = new Set([
  "QUEUED",
  "DOWNLOADING",
  "SECURITY_SCAN",
  "EXTRACTING",
  "OCR",
  "QUALITY_CHECK",
]);

export function provenanceFromDocNodeKind(kind?: string | null): ExtractionProvenance {
  const k = (kind || "").toLowerCase();
  if (k.includes("qari")) return "SERVER_QARI";
  if (k.includes("gemini") || k.includes("cloud") || k.includes("vision")) return "SERVER_GEMINI";
  return "SERVER_LOCAL";
}

export function isServerProvenance(p: ExtractionProvenance): boolean {
  return p === "SERVER_LOCAL" || p === "SERVER_GEMINI" || p === "SERVER_QARI";
}

export function verificationForProvenance(p: ExtractionProvenance): VerificationStatus {
  if (isServerProvenance(p)) return "SERVER_VERIFIED";
  if (p === "CLIENT_PREVIEW") return "PREVIEW_ONLY";
  return "CLIENT_UNVERIFIED";
}

export type ApplyClientExtractionDecision =
  | { action: "preview_only"; reason: string }
  | { action: "fallback_write"; reason: string }
  | { action: "reject"; code: string; reason: string };

/**
 * يقرر ماذا يفعل نص المتصفح تجاه حالة المرفق الحالية.
 */
export function decideClientExtractionWrite(input: {
  processingStatus: string;
  metadata: Record<string, unknown>;
  documentProcessingV2: boolean;
  docNodeConfigured: boolean;
}): ApplyClientExtractionDecision {
  const meta = input.metadata;
  const hasActiveJob =
    typeof meta.docNodeJobId === "string" &&
    meta.docNodeJobId &&
    ACTIVE_SERVER_JOB_STATUSES.has(input.processingStatus);
  const serverVerified = meta.verificationStatus === "SERVER_VERIFIED";
  const provenance = meta.extractionProvenance as ExtractionProvenance | undefined;

  // أ) doc-node نشط أو مفعّل ومتاح → معاينة فقط
  if (input.documentProcessingV2 && (input.docNodeConfigured || hasActiveJob)) {
    if (hasActiveJob || input.processingStatus === "EXTRACTING" || input.processingStatus === "OCR" || input.processingStatus === "QUEUED") {
      return {
        action: "preview_only",
        reason: "DOC_NODE_AUTHORITATIVE_ACTIVE",
      };
    }
    if (serverVerified || (provenance && isServerProvenance(provenance))) {
      return {
        action: "preview_only",
        reason: "SERVER_ALREADY_VERIFIED",
      };
    }
    // V2 مفعّل وdoc-node مضبوط لكن لا Job بعد — لا نسمح بـ READY من العميل
    if (input.docNodeConfigured) {
      return {
        action: "preview_only",
        reason: "DOC_NODE_PREFERRED_NO_FALLBACK_YET",
      };
    }
  }

  // ب) doc-node غير متاح أو المعالجة معطلة → fallback عميل
  if (!input.documentProcessingV2 || !input.docNodeConfigured) {
    if (serverVerified) {
      return { action: "reject", code: "SERVER_AUTHORITATIVE", reason: "لا يستبدل نص خادمي موثق." };
    }
    return {
      action: "fallback_write",
      reason: input.documentProcessingV2 ? "DOC_NODE_UNAVAILABLE_FALLBACK" : "PROCESSING_V2_OFF_FALLBACK",
    };
  }

  return { action: "preview_only", reason: "DEFAULT_PREVIEW" };
}

/**
 * هل يُسمح لناتج doc-node (jobId) بالكتابة فوق الحالة الحالية؟
 */
export function decideServerJobWrite(input: {
  incomingJobId: string;
  metadata: Record<string, unknown>;
  forceReprocess?: boolean;
}): { allow: boolean; reason: string } {
  const currentJobId = typeof input.metadata.docNodeJobId === "string" ? input.metadata.docNodeJobId : null;
  const generation = Number(input.metadata.docNodeGeneration ?? 0);
  const completedGeneration = Number(input.metadata.docNodeCompletedGeneration ?? -1);

  if (input.forceReprocess) {
    return { allow: true, reason: "FORCE_REPROCESS" };
  }
  if (currentJobId && currentJobId !== input.incomingJobId) {
    return { allow: false, reason: "STALE_JOB_ID" };
  }
  if (completedGeneration >= 0 && generation > 0 && completedGeneration >= generation) {
    // اكتملت هذه الـ generation أو أحدث
    if (completedGeneration > generation) {
      return { allow: false, reason: "STALE_GENERATION" };
    }
  }
  return { allow: true, reason: "CURRENT_JOB" };
}

export const CLIENT_EXTRACTION_MAX_CHARS = 200_000;

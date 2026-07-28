/** حالة الميزات لـ health — يتجنب استيراد دائري مع feature-flags القديمة. */
export function isDirectUrlImportEnabledSafe(): boolean {
  return process.env.DOCUMENT_DIRECT_URL_IMPORT_ENABLED === "true" || process.env.DOCUMENT_DIRECT_URL_IMPORT_ENABLED === "1";
}

export {
  isDocumentMalwareScanEnabled,
  isDocumentMetricsEnabled,
  isDocumentQueueEnabled,
  isDocumentRateLimitEnabled
} from "@/lib/modules/documents/document-limits";

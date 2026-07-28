/** أعلام وحدود استيراد الروابط المباشرة والتشغيل. */

import { getDocumentLimits } from "@/lib/modules/documents/document-limits";

export function isDirectUrlImportEnabled(): boolean {
  return (
    process.env.DOCUMENT_DIRECT_URL_IMPORT_ENABLED === "true" ||
    process.env.DOCUMENT_DIRECT_URL_IMPORT_ENABLED === "1"
  );
}

export function isMalwareScanEnabled(): boolean {
  return (
    process.env.DOCUMENT_MALWARE_SCAN_ENABLED === "true" ||
    process.env.DOCUMENT_MALWARE_SCAN_ENABLED === "1"
  );
}

export function isMalwareScanFailClosed(): boolean {
  return process.env.DOCUMENT_MALWARE_SCAN_FAIL_CLOSED !== "false";
}

export function isDocumentQueueEnabled(): boolean {
  return process.env.DOCUMENT_QUEUE_ENABLED === "true" || process.env.DOCUMENT_QUEUE_ENABLED === "1";
}

export function isDocumentMetricsEnabled(): boolean {
  return process.env.DOCUMENT_METRICS_ENABLED !== "false";
}

export function isDocumentRateLimitEnabled(): boolean {
  return process.env.DOCUMENT_RATE_LIMIT_ENABLED !== "false";
}

export function directUrlMaxBytes(): number {
  return getDocumentLimits().maxDirectUrlBytes;
}

export function directUrlTimeoutMs(): number {
  return getDocumentLimits().downloadTimeoutMs;
}

export function directUrlMaxRedirects(): number {
  return getDocumentLimits().maxRedirects;
}

export function urlInspectMaxBytes(): number {
  return getDocumentLimits().maxInspectBytes;
}

export function urlInspectTimeoutMs(): number {
  return getDocumentLimits().inspectTimeoutMs;
}

/** مصدر حقيقة واحد لحدود منصة الوثائق. */

function positiveInt(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export interface DocumentLimits {
  maxUploadBytes: number;
  maxDirectUrlBytes: number;
  maxInspectBytes: number;
  maxFileNameLength: number;
  maxRedirects: number;
  downloadTimeoutMs: number;
  inspectTimeoutMs: number;
  tempFileMaxAgeMinutes: number;
  jobMaxAttempts: number;
  jobTimeoutMs: number;
  rateLimitInspectMax: number;
  rateLimitImportMax: number;
  rateLimitUploadMax: number;
  rateLimitWindowSeconds: number;
}

export function getDocumentLimits(): DocumentLimits {
  return {
    maxUploadBytes: positiveInt("DOCUMENT_MAX_UPLOAD_BYTES", 104_857_600),
    maxDirectUrlBytes: positiveInt("DOCUMENT_DIRECT_URL_MAX_BYTES", 104_857_600),
    maxInspectBytes: positiveInt("DOCUMENT_URL_INSPECT_MAX_BYTES", 65_536),
    maxFileNameLength: 180,
    maxRedirects: positiveInt("DOCUMENT_DIRECT_URL_MAX_REDIRECTS", 5),
    downloadTimeoutMs: positiveInt("DOCUMENT_DIRECT_URL_TIMEOUT_MS", 120_000),
    inspectTimeoutMs: positiveInt("DOCUMENT_URL_INSPECT_TIMEOUT_MS", 15_000),
    tempFileMaxAgeMinutes: positiveInt("DOCUMENT_TEMP_FILE_MAX_AGE_MINUTES", 60),
    jobMaxAttempts: positiveInt("DOCUMENT_JOB_MAX_ATTEMPTS", 3),
    jobTimeoutMs: positiveInt("DOCUMENT_JOB_TIMEOUT_MS", 300_000),
    rateLimitInspectMax: positiveInt("DOCUMENT_RATE_LIMIT_INSPECT_MAX", 30),
    rateLimitImportMax: positiveInt("DOCUMENT_RATE_LIMIT_IMPORT_MAX", 10),
    rateLimitUploadMax: positiveInt("DOCUMENT_RATE_LIMIT_UPLOAD_MAX", 20),
    rateLimitWindowSeconds: positiveInt("DOCUMENT_RATE_LIMIT_WINDOW_SECONDS", 60)
  };
}

export function isDocumentRateLimitEnabled(): boolean {
  return process.env.DOCUMENT_RATE_LIMIT_ENABLED !== "false" && process.env.DOCUMENT_RATE_LIMIT_ENABLED !== "0";
}

export function isDocumentMalwareScanEnabled(): boolean {
  return process.env.DOCUMENT_MALWARE_SCAN_ENABLED === "true" || process.env.DOCUMENT_MALWARE_SCAN_ENABLED === "1";
}

export function isDocumentMalwareFailClosed(): boolean {
  return process.env.DOCUMENT_MALWARE_SCAN_FAIL_CLOSED !== "false" && process.env.DOCUMENT_MALWARE_SCAN_FAIL_CLOSED !== "0";
}

export function isDocumentQueueEnabled(): boolean {
  return process.env.DOCUMENT_QUEUE_ENABLED === "true" || process.env.DOCUMENT_QUEUE_ENABLED === "1";
}

export function isDocumentMetricsEnabled(): boolean {
  return process.env.DOCUMENT_METRICS_ENABLED !== "false" && process.env.DOCUMENT_METRICS_ENABLED !== "0";
}

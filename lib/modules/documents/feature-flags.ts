/** أعلام ميزة استيراد الروابط المباشرة — افتراضيًا معطّلة. */
export function isDirectUrlImportEnabled(): boolean {
  return process.env.DOCUMENT_DIRECT_URL_IMPORT_ENABLED === "true" || process.env.DOCUMENT_DIRECT_URL_IMPORT_ENABLED === "1";
}

export function directUrlMaxBytes(): number {
  const n = Number(process.env.DOCUMENT_DIRECT_URL_MAX_BYTES);
  return Number.isFinite(n) && n > 0 ? n : 104_857_600; // 100 MB
}

export function directUrlTimeoutMs(): number {
  const n = Number(process.env.DOCUMENT_DIRECT_URL_TIMEOUT_MS);
  return Number.isFinite(n) && n > 0 ? n : 120_000;
}

export function directUrlMaxRedirects(): number {
  const n = Number(process.env.DOCUMENT_DIRECT_URL_MAX_REDIRECTS);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 5;
}

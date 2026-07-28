/** أعلام وحدود استيراد الروابط المباشرة — افتراضيًا معطّلة. */

function positiveInt(envName: string, fallback: number): number {
  const n = Number(process.env[envName]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export function isDirectUrlImportEnabled(): boolean {
  return process.env.DOCUMENT_DIRECT_URL_IMPORT_ENABLED === "true" || process.env.DOCUMENT_DIRECT_URL_IMPORT_ENABLED === "1";
}

export function directUrlMaxBytes(): number {
  return positiveInt("DOCUMENT_DIRECT_URL_MAX_BYTES", 104_857_600);
}

export function directUrlTimeoutMs(): number {
  return positiveInt("DOCUMENT_DIRECT_URL_TIMEOUT_MS", 120_000);
}

export function directUrlMaxRedirects(): number {
  return positiveInt("DOCUMENT_DIRECT_URL_MAX_REDIRECTS", 5);
}

/** حد قراءة جسم inspect عند اضطرار GET (افتراضي 64KB). */
export function urlInspectMaxBytes(): number {
  return positiveInt("DOCUMENT_URL_INSPECT_MAX_BYTES", 65_536);
}

/** مهلة أقصر للفحص فقط. */
export function urlInspectTimeoutMs(): number {
  return positiveInt("DOCUMENT_URL_INSPECT_TIMEOUT_MS", 15_000);
}

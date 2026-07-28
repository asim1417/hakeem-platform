import { isDocumentMetricsEnabled } from "@/lib/modules/documents/document-limits";

type CounterKey = string;

const counters = new Map<CounterKey, number>();
const timings: Array<{ name: string; ms: number; labels: Record<string, string> }> = [];

const ALLOWED_LABELS = new Set(["provider", "status", "mimeGroup", "errorCode", "engine", "scope"]);

function labelKey(name: string, labels: Record<string, string>): string {
  const parts = Object.entries(labels)
    .filter(([k]) => ALLOWED_LABELS.has(k))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`);
  return `${name}|${parts.join(",")}`;
}

export function incDocumentMetric(name: string, labels: Record<string, string> = {}, by = 1): void {
  if (!isDocumentMetricsEnabled()) return;
  // ارفض labels عالية التعدد
  for (const k of Object.keys(labels)) {
    if (!ALLOWED_LABELS.has(k)) return;
  }
  const key = labelKey(name, labels);
  counters.set(key, (counters.get(key) ?? 0) + by);
}

/** واجهة موحدة: الاسم ثم القيمة ثم الأبعاد */
export function recordDocumentMetric(
  name: string,
  value = 1,
  labels: Record<string, string> = {}
): void {
  if (name.endsWith("_ms") || name.includes("duration")) {
    observeDocumentDuration(name, value, labels);
    return;
  }
  incDocumentMetric(name, labels, value);
}

export function observeDocumentDuration(name: string, ms: number, labels: Record<string, string> = {}): void {
  if (!isDocumentMetricsEnabled()) return;
  for (const k of Object.keys(labels)) {
    if (!ALLOWED_LABELS.has(k)) return;
  }
  timings.push({ name, ms, labels });
  if (timings.length > 5000) timings.shift();
}

export function getDocumentMetricSnapshot(): { counters: Record<string, number>; timingsCount: number } {
  return { counters: Object.fromEntries(counters), timingsCount: timings.length };
}

export function __resetDocumentMetricsForTests(): void {
  counters.clear();
  timings.length = 0;
}

import { normalizeForCompare } from "../normalize/arabic";
import type { RasdConflictType, RasdSeverity, SourceConflictDraft } from "../types";

const FIELD_CONFLICT_TYPES: Array<{ pattern: RegExp; type: RasdConflictType; severity: RasdSeverity }> = [
  { pattern: /status|الحالة/u, type: "STATUS_CONFLICT", severity: "HIGH" },
  { pattern: /date|تاريخ/u, type: "DATE_CONFLICT", severity: "MEDIUM" },
  { pattern: /text|content|النص|المادة/u, type: "TEXT_CONFLICT", severity: "HIGH" }
];

function classify(field: string): { type: RasdConflictType; severity: RasdSeverity } {
  return FIELD_CONFLICT_TYPES.find((item) => item.pattern.test(field)) ?? { type: "METADATA_CONFLICT", severity: "MEDIUM" };
}

export function detectSourceConflicts(
  versionsBySource: Record<string, { field: string; value: string }[]>
): SourceConflictDraft[] {
  const valuesByField = new Map<string, Record<string, string>>();

  for (const [source, entries] of Object.entries(versionsBySource)) {
    for (const entry of entries) {
      const existing = valuesByField.get(entry.field) ?? {};
      existing[source] = entry.value;
      valuesByField.set(entry.field, existing);
    }
  }

  const conflicts: SourceConflictDraft[] = [];
  for (const [fieldName, bySource] of valuesByField.entries()) {
    const normalizedValues = new Map<string, string[]>();
    for (const [source, value] of Object.entries(bySource)) {
      const normalized = normalizeForCompare(value);
      const sources = normalizedValues.get(normalized) ?? [];
      sources.push(source);
      normalizedValues.set(normalized, sources);
    }

    if (normalizedValues.size <= 1) continue;

    const { type, severity } = classify(fieldName);
    conflicts.push({
      fieldName,
      valuesBySource: bySource,
      conflictType: type,
      severity,
      status: "OPEN",
      evidence: {
        normalizedGroups: [...normalizedValues.entries()].map(([value, sources]) => ({ value, sources }))
      }
    });
  }

  return conflicts;
}

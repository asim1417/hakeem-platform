"use client";

import type { ComposerSuggestion } from "@/lib/modules/hakeem-composer/types";

export function SmartSuggestions({
  suggestions,
  onSelect,
}: {
  suggestions: ComposerSuggestion[];
  onSelect: (s: ComposerSuggestion) => void;
}) {
  if (!suggestions.length) return null;
  return (
    <ul className="hkm-composer__suggestions" aria-label="اقتراحات ذكية">
      {suggestions.map((s) => (
        <li key={s.id}>
          <button type="button" className="hkm-composer__chip focus-ring" onClick={() => onSelect(s)}>
            {s.label}
          </button>
        </li>
      ))}
    </ul>
  );
}

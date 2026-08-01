"use client";

import type { ComposerMention } from "@/lib/modules/hakeem-composer/types";

export function MentionMenu({
  mentions,
  activeIndex,
  onSelect,
  onHover,
}: {
  mentions: ComposerMention[];
  activeIndex: number;
  onSelect: (mention: ComposerMention) => void;
  onHover: (index: number) => void;
}) {
  if (!mentions.length) return null;
  return (
    <ul className="hkm-composer__popup" role="listbox" aria-label="الإشارات">
      {mentions.map((m, i) => (
        <li key={m.id} role="option" aria-selected={i === activeIndex}>
          <button
            type="button"
            className={`hkm-composer__popup-item focus-ring ${i === activeIndex ? "is-active" : ""}`}
            onMouseEnter={() => onHover(i)}
            onClick={() => onSelect(m)}
          >
            <code>{m.insertText}</code>
            <span>
              <strong>{m.label}</strong>
              <em>{m.description}</em>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

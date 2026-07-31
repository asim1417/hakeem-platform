"use client";

import type { ComposerSlashCommand } from "@/lib/modules/hakeem-composer/types";

export function SlashCommandMenu({
  commands,
  activeIndex,
  onSelect,
  onHover,
}: {
  commands: ComposerSlashCommand[];
  activeIndex: number;
  onSelect: (cmd: ComposerSlashCommand) => void;
  onHover: (index: number) => void;
}) {
  if (!commands.length) return null;
  return (
    <ul className="hkm-composer__popup" role="listbox" aria-label="الأوامر المختصرة">
      {commands.map((cmd, i) => (
        <li key={cmd.id} role="option" aria-selected={i === activeIndex}>
          <button
            type="button"
            className={`hkm-composer__popup-item focus-ring ${i === activeIndex ? "is-active" : ""}`}
            onMouseEnter={() => onHover(i)}
            onClick={() => onSelect(cmd)}
          >
            <code>{cmd.command}</code>
            <span>
              <strong>{cmd.label}</strong>
              <em>{cmd.description}</em>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

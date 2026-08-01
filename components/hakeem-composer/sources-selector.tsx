"use client";

import { COMPOSER_SOURCES } from "@/lib/modules/hakeem-composer/constants";
import type { ComposerSourceId } from "@/lib/modules/hakeem-composer/types";
import { Library } from "lucide-react";

export function SourcesSelector({
  sources,
  onChange,
  open,
  onOpenChange,
}: {
  sources: ComposerSourceId[];
  onChange: (sources: ComposerSourceId[]) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  function toggle(id: ComposerSourceId) {
    if (id === "attached-only") {
      onChange(sources.includes(id) ? ["legal-core"] : ["attached-only"]);
      return;
    }
    const withoutExclusive = sources.filter((s) => s !== "attached-only");
    if (withoutExclusive.includes(id)) {
      const next = withoutExclusive.filter((s) => s !== id);
      onChange(next.length ? next : ["legal-core"]);
    } else {
      onChange([...withoutExclusive, id]);
    }
  }

  const label =
    sources.length === 1
      ? COMPOSER_SOURCES.find((s) => s.id === sources[0])?.label ?? "المصادر"
      : `${sources.length.toLocaleString("ar-SA")} مصادر`;

  return (
    <div className="hkm-composer__menu-wrap">
      <button
        type="button"
        className={`hkm-composer__tool-btn focus-ring ${open ? "is-active" : ""}`}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`المصادر: ${label}`}
        title="نطاق البحث والمصادر"
        onClick={() => onOpenChange(!open)}
      >
        <Library size={15} aria-hidden />
        <span>{label}</span>
      </button>
      {open ? (
        <ul className="hkm-composer__menu" role="listbox" aria-label="مصادر البحث">
          {COMPOSER_SOURCES.map((s) => {
            const active = sources.includes(s.id);
            return (
              <li key={s.id} role="option" aria-selected={active}>
                <button
                  type="button"
                  className={`hkm-composer__menu-item focus-ring ${active ? "is-active" : ""}`}
                  onClick={() => toggle(s.id)}
                >
                  <span className="hkm-composer__check" aria-hidden>
                    {active ? "✓" : ""}
                  </span>
                  <span>
                    <strong>{s.label}</strong>
                    <em>{s.description}</em>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

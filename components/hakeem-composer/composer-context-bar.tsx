"use client";

import type { ComposerContextItem } from "@/lib/modules/hakeem-composer/types";
import { X } from "lucide-react";

export function ComposerContextBar({
  items,
  onRemove,
}: {
  items: ComposerContextItem[];
  onRemove?: (id: string) => void;
}) {
  if (!items.length) return null;
  return (
    <div className="hkm-composer__context" aria-label="السياق النشط">
      {items.map((item) => (
        <span key={item.id} className="hkm-composer__context-chip">
          <span className="hkm-composer__context-label">{item.label}</span>
          {item.removable !== false && onRemove ? (
            <button
              type="button"
              className="hkm-composer__context-remove focus-ring"
              onClick={() => onRemove(item.id)}
              aria-label={`إزالة سياق ${item.label}`}
            >
              <X size={12} aria-hidden />
            </button>
          ) : null}
        </span>
      ))}
    </div>
  );
}

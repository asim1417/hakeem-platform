"use client";

import { AGENT_MODES } from "@/lib/modules/agents/modes";
import type { ComposerModeId } from "@/lib/modules/hakeem-composer/types";
import {
  ClipboardList,
  MessagesSquare,
  NotebookPen,
  Scale,
  ScanSearch,
  Sparkles,
  Wand2,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<ComposerModeId, LucideIcon> = {
  auto: Wand2,
  ask: Sparkles,
  "analyze-case": ScanSearch,
  "action-plan": ClipboardList,
  "verdict-estimate": Scale,
  consultation: NotebookPen,
  chat: MessagesSquare,
};

const AUTO_MODE = {
  id: "auto" as const,
  name: "تلقائي",
  hint: "يستنتج حكيم المسار الأنسب من طلبك",
};

export function ModeSelector({
  modeId,
  onChange,
  open,
  onOpenChange,
}: {
  modeId: ComposerModeId;
  onChange: (mode: ComposerModeId) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const current =
    modeId === "auto"
      ? AUTO_MODE
      : AGENT_MODES.find((m) => m.id === modeId) ?? AGENT_MODES[0];
  const CurrentIcon = ICONS[modeId] ?? Sparkles;

  return (
    <div className="hkm-composer__menu-wrap">
      <button
        type="button"
        className={`hkm-composer__tool-btn focus-ring ${open ? "is-active" : ""}`}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`نمط العمل: ${current.name}`}
        title={current.hint}
        onClick={() => onOpenChange(!open)}
      >
        <CurrentIcon size={15} aria-hidden />
        <span>{current.name}</span>
      </button>
      {open ? (
        <ul className="hkm-composer__menu" role="listbox" aria-label="أنماط العمل">
          {[AUTO_MODE, ...AGENT_MODES].map((m) => {
            const Icon = ICONS[m.id as ComposerModeId] ?? Sparkles;
            const active = m.id === modeId;
            return (
              <li key={m.id} role="option" aria-selected={active}>
                <button
                  type="button"
                  className={`hkm-composer__menu-item focus-ring ${active ? "is-active" : ""}`}
                  onClick={() => {
                    onChange(m.id as ComposerModeId);
                    onOpenChange(false);
                  }}
                >
                  <Icon size={14} aria-hidden />
                  <span>
                    <strong>{m.name}</strong>
                    <em>{"hint" in m ? m.hint : ""}</em>
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

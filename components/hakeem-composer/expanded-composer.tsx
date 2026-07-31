"use client";

import { Maximize2, Minimize2, X } from "lucide-react";

export function ExpandedComposerDialog({
  open,
  value,
  onChange,
  onClose,
  onSubmit,
  maxChars,
  busy,
}: {
  open: boolean;
  value: string;
  onChange: (v: string) => void;
  onClose: () => void;
  onSubmit: () => void;
  maxChars: number;
  busy?: boolean;
}) {
  if (!open) return null;
  const words = value.trim() ? value.trim().split(/\s+/).length : 0;
  return (
    <div className="hkm-composer__expand-backdrop" role="presentation" onClick={onClose}>
      <div
        className="hkm-composer__expand"
        role="dialog"
        aria-modal="true"
        aria-label="محرر موسّع"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="hkm-composer__expand-head">
          <h2>محرر موسّع</h2>
          <button type="button" className="focus-ring hkm-composer__icon-btn" onClick={onClose} aria-label="إغلاق المحرر">
            <X size={16} aria-hidden />
          </button>
        </div>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value.slice(0, maxChars))}
          className="hkm-composer__expand-input"
          rows={16}
          autoFocus
          aria-label="نص الطلب في المحرر الموسّع"
        />
        <div className="hkm-composer__expand-foot">
          <p>
            {words.toLocaleString("ar-SA")} كلمة · {value.length.toLocaleString("ar-SA")} /{" "}
            {maxChars.toLocaleString("ar-SA")}
          </p>
          <div className="hkm-composer__expand-actions">
            <button type="button" className="hkm-composer__secondary focus-ring" onClick={onClose}>
              <Minimize2 size={14} aria-hidden /> تصغير
            </button>
            <button
              type="button"
              className="hkm-composer__primary focus-ring"
              disabled={busy || !value.trim()}
              onClick={() => {
                onSubmit();
                onClose();
              }}
            >
              إرسال
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ExpandButton({
  visible,
  onClick,
}: {
  visible: boolean;
  onClick: () => void;
}) {
  if (!visible) return null;
  return (
    <button
      type="button"
      className="hkm-composer__tool-btn focus-ring"
      onClick={onClick}
      aria-label="فتح المحرر الموسّع"
      title="فتح في محرر موسّع"
    >
      <Maximize2 size={15} aria-hidden />
      <span className="hkm-composer__tool-label">توسيع</span>
    </button>
  );
}

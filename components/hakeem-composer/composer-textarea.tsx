"use client";

import { useEffect, useRef } from "react";

export function ComposerTextarea({
  value,
  onChange,
  onKeyDown,
  onSelect,
  placeholder,
  disabled,
  maxChars,
  rows,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onSelect?: (caret: number) => void;
  placeholder?: string;
  disabled?: boolean;
  maxChars: number;
  rows?: number;
  id?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    const next = Math.min(el.scrollHeight, 220);
    el.style.height = `${Math.max(next, 44)}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      id={id}
      value={value}
      disabled={disabled}
      rows={rows ?? 1}
      placeholder={placeholder}
      aria-label="صندوق أمر حكيم"
      className="hkm-composer__textarea"
      onChange={(e) => {
        const next = e.target.value.slice(0, maxChars);
        onChange(next);
        onSelect?.(e.target.selectionStart ?? next.length);
      }}
      onClick={(e) => onSelect?.(e.currentTarget.selectionStart ?? 0)}
      onKeyUp={(e) => onSelect?.(e.currentTarget.selectionStart ?? 0)}
      onSelect={(e) => onSelect?.(e.currentTarget.selectionStart ?? 0)}
      onKeyDown={onKeyDown}
    />
  );
}

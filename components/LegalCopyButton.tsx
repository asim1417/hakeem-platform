"use client";

import { useState } from "react";
import { Copy } from "lucide-react";

export function LegalCopyButton({ text, label = "نسخ" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <button type="button" onClick={() => void copy()} className="btn btn-outline">
      <Copy size={16} />
      {copied ? "تم النسخ" : label}
    </button>
  );
}

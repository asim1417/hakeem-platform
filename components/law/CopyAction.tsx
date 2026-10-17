"use client";

import { useState } from "react";
import { Check, Copy, Link as LinkIcon, TextQuote } from "lucide-react";

/** يعلن رسالة في المنطقة الحية الوحيدة للصفحة (#law-live). */
export function announce(message: string) {
  const el = typeof document !== "undefined" ? document.getElementById("law-live") : null;
  if (!el) return;
  el.textContent = "";
  window.setTimeout(() => {
    el.textContent = message;
  }, 30);
}

export async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

const TIPS = { text: "نسخ النص", cite: "نسخ الإحالة", link: "نسخ رابط المادة" } as const;

/** زر أيقونة للنسخ (ع-٥، ع-١٥): aria-label يسمّي المادة، وتلميح ظاهر عند التمرير والتركيز، وإعلان في role=status. */
export function CopyAction({ kind, label, value }: { kind: "text" | "cite" | "link"; label: string; value: string }) {
  const [done, setDone] = useState(false);
  const Icon = done ? Check : kind === "link" ? LinkIcon : kind === "cite" ? TextQuote : Copy;
  return (
    <button
      type="button"
      className="iconbtn iconbtn--fine"
      aria-label={label}
      onClick={async () => {
        const ok = await copyText(value);
        announce(ok ? `نُسخ: ${TIPS[kind]}` : "تعذّر النسخ. انسخ يدويًا من الصفحة.");
        if (ok) {
          setDone(true);
          window.setTimeout(() => setDone(false), 2000);
        }
      }}
    >
      <Icon aria-hidden size={20} className={kind === "cite" && !done ? "mirror" : undefined} />
      <span className="tip" aria-hidden>
        {TIPS[kind]}
      </span>
    </button>
  );
}

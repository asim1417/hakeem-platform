"use client";

import { useEffect } from "react";

/**
 * اختصارات لوحة المفاتيح للطابور: j/↓ التالي، k/↑ السابق، a اعتماد، r رفض، e تصحيح، x تحديد.
 * لا تعمل أثناء الكتابة في حقل.
 */
export function useQueueKeys(handlers: Partial<Record<"next" | "prev" | "approve" | "reject" | "edit" | "toggle", () => void>>, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
      const map: Record<string, keyof typeof handlers> = {
        j: "next",
        ArrowDown: "next",
        k: "prev",
        ArrowUp: "prev",
        a: "approve",
        r: "reject",
        e: "edit",
        x: "toggle",
      };
      const action = map[event.key];
      const fn = action ? handlers[action] : undefined;
      if (fn) {
        event.preventDefault();
        fn();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handlers, enabled]);
}

"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const KEY = "hakeem:scroll:";

/**
 * يحفظ موضع التمرير لكل مسار ويستعيده عند العودة (بدون كسر التمرير الطبيعي لأول زيارة).
 */
export function ScrollRestorer() {
  const pathname = usePathname() || "/";

  useEffect(() => {
    const key = KEY + pathname;
    const raw = sessionStorage.getItem(key);
    if (raw) {
      const y = Number(raw);
      if (Number.isFinite(y) && y > 0) {
        requestAnimationFrame(() => window.scrollTo(0, y));
      }
    }

    const onScroll = () => {
      sessionStorage.setItem(key, String(window.scrollY || 0));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [pathname]);

  return null;
}

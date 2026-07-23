"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const KEY = "hakeem:scroll:";

function readScroll(key: string): number {
  try {
    const raw = sessionStorage.getItem(key);
    const y = Number(raw);
    return Number.isFinite(y) && y > 0 ? y : 0;
  } catch {
    return 0;
  }
}

function writeScroll(key: string, y: number) {
  try {
    sessionStorage.setItem(key, String(y));
  } catch {
    // Safari خاص / وضع خاص قد يمنع التخزين — لا نُسقط الصفحة
  }
}

/**
 * يحفظ موضع التمرير لكل مسار ويستعيده عند العودة (بدون كسر التمرير الطبيعي لأول زيارة).
 */
export function ScrollRestorer() {
  const pathname = usePathname() || "/";

  useEffect(() => {
    const key = KEY + pathname;
    const y = readScroll(key);
    if (y > 0) {
      requestAnimationFrame(() => {
        try {
          window.scrollTo(0, y);
        } catch {
          /* ignore */
        }
      });
    }

    const onScroll = () => writeScroll(key, window.scrollY || 0);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [pathname]);

  return null;
}

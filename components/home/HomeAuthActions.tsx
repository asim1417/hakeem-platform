"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * يُظهر محتوى الضيف من الخادم فورًا، ثم يستبدله بهدوء إن وُجدت جلسة مستخدم.
 * لا يعتمد على Clerk في المسار الحرج — يمنع الشاشة البيضاء عند فشل hydration.
 */
export function HomeAuthActions({ guest, user }: { guest: ReactNode; user: ReactNode }) {
  const [isUser, setIsUser] = useState(false);

  useEffect(() => {
    let active = true;
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), 4000);

    fetch("/api/auth/me", { signal: ctrl.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active) return;
        if (data?.user && !data.isGuest) setIsUser(true);
      })
      .catch(() => {
        /* الضيف يبقى ظاهرًا */
      })
      .finally(() => window.clearTimeout(timer));

    return () => {
      active = false;
      ctrl.abort();
      window.clearTimeout(timer);
    };
  }, []);

  return <>{isUser ? user : guest}</>;
}

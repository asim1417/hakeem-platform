"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { HOME_AUTH_CHANGED_EVENT } from "@/lib/modules/config/home-inline-auth";
import { markHomeUserKnown } from "@/components/home/home-auth-bus";

type HomeUser = { name: string | null };

const HomeUserContext = createContext<HomeUser | null>(null);

/**
 * يُظهر محتوى الضيف من الخادم فورًا، ثم يستبدله بهدوء إن وُجدت جلسة مستخدم.
 * لا يعتمد على Clerk في المسار الحرج — يمنع الشاشة البيضاء عند فشل hydration.
 * يتحدّث أيضًا دون إعادة تحميل عند الدخول من حوار الصفحة الرئيسية (hakeem:auth-changed).
 */
export function HomeAuthActions({ guest, user }: { guest: ReactNode; user: ReactNode }) {
  const [isUser, setIsUser] = useState(false);
  const [homeUser, setHomeUser] = useState<HomeUser | null>(null);

  useEffect(() => {
    let active = true;
    const ctrl = new AbortController();
    const timer = window.setTimeout(() => ctrl.abort(), 4000);

    fetch("/api/auth/me", { signal: ctrl.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active) return;
        if (data?.user && !data.isGuest) {
          markHomeUserKnown();
          setIsUser(true);
          setHomeUser({ name: typeof data.user.name === "string" ? data.user.name : null });
        }
      })
      .catch(() => {
        /* الضيف يبقى ظاهرًا */
      })
      .finally(() => window.clearTimeout(timer));

    const onChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ name?: string | null } | null>).detail;
      setIsUser(true);
      setHomeUser({ name: typeof detail?.name === "string" ? detail.name : null });
    };
    window.addEventListener(HOME_AUTH_CHANGED_EVENT, onChanged);

    return () => {
      active = false;
      ctrl.abort();
      window.clearTimeout(timer);
      window.removeEventListener(HOME_AUTH_CHANGED_EVENT, onChanged);
    };
  }, []);

  return <HomeUserContext.Provider value={homeUser}>{isUser ? user : guest}</HomeUserContext.Provider>;
}

/** اسم المستخدم في الشريط بعد الدخول (الاسم الأول فقط)، أو النص البديل. */
export function HomeAuthUserName({ fallback }: { fallback: string }) {
  const u = useContext(HomeUserContext);
  const first = (u?.name || "").trim().split(/\s+/)[0];
  if (!first) return <>{fallback}</>;
  return (
    <>
      <span>مرحبًا، {first}</span>
      <span className="sr-only"> — {fallback}</span>
    </>
  );
}

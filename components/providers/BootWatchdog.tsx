"use client";

import { useEffect, useState } from "react";

/**
 * إنقاذ من الشاشة البيضاء (فشل hydration / bfcache على Safari/iOS).
 * تقنيات حديثة: pageshow + visibilitychange دون كسر التحميل الطبيعي.
 */
export function BootWatchdog() {
  const [rescue, setRescue] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const looksEmpty = () => {
      try {
        const text = (document.body?.innerText || "").replace(/\s+/g, " ").trim();
        return text.length < 40;
      } catch {
        return true;
      }
    };

    const maybeRescue = () => {
      if (!cancelled && looksEmpty()) setRescue(true);
    };

    const id = window.setTimeout(maybeRescue, 4000);

    // Safari: العودة من bfcache أحياناً تترك DOM فارغاً بصرياً
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        window.setTimeout(maybeRescue, 300);
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        window.setTimeout(maybeRescue, 500);
      }
    };

    window.addEventListener("pageshow", onPageShow);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      window.clearTimeout(id);
      window.removeEventListener("pageshow", onPageShow);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  if (!rescue) return null;

  return (
    <div
      role="alert"
      dir="rtl"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100000,
        display: "grid",
        placeItems: "center",
        background: "#EFF3F2",
        padding: 24,
        fontFamily: '"IBM Plex Sans Arabic", Tahoma, sans-serif',
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 400,
          background: "#FBFAF6",
          border: "1px solid rgba(18,33,31,0.12)",
          borderRadius: 16,
          padding: 24,
          textAlign: "center",
        }}
      >
        <p style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#0E3435" }}>حكيم</p>
        <p style={{ margin: "12px 0 0", fontSize: 15, lineHeight: 1.7, color: "rgba(18,33,31,0.7)" }}>
          الصفحة لم تكتمل التحميل. أعد المحاولة، أو عد إلى الصفحة الرئيسية.
        </p>
        <div
          style={{
            marginTop: 18,
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            justifyContent: "center",
          }}
        >
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              minHeight: 44,
              border: 0,
              borderRadius: 12,
              background: "#0E3435",
              color: "#FFFcf7",
              fontWeight: 700,
              padding: "0 16px",
            }}
          >
            تحديث الصفحة
          </button>
          <a
            href="/sign-in"
            style={{
              minHeight: 44,
              display: "inline-flex",
              alignItems: "center",
              borderRadius: 12,
              border: "1px solid rgba(18,33,31,0.15)",
              background: "#fff",
              color: "#0E3435",
              fontWeight: 700,
              textDecoration: "none",
              padding: "0 16px",
            }}
          >
            تسجيل الدخول
          </a>
          <a
            href="/"
            style={{
              minHeight: 44,
              display: "inline-flex",
              alignItems: "center",
              borderRadius: 12,
              border: "1px solid rgba(18,33,31,0.15)",
              background: "#fff",
              color: "#0E3435",
              fontWeight: 700,
              textDecoration: "none",
              padding: "0 16px",
            }}
          >
            الرئيسية
          </a>
        </div>
      </div>
    </div>
  );
}

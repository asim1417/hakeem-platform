"use client";

/**
 * يلتقط أخطاء جذرية (layout / Clerk) التي لا يلتقطها error.tsx.
 * بدون هذا الملف يعرض Next الرسالة الإنجليزية Application error على الجوال.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          background: "#EFF3F2",
          color: "#12211F",
          fontFamily: '"IBM Plex Sans Arabic", Tahoma, sans-serif',
          padding: 24,
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 420,
            background: "#FBFAF6",
            border: "1px solid rgba(18,33,31,0.1)",
            borderRadius: 16,
            padding: 28,
            textAlign: "center",
            boxShadow: "0 8px 30px rgba(14,52,53,0.08)",
          }}
        >
          <p style={{ margin: 0, fontSize: 28, fontWeight: 700, color: "#0E3435" }}>حكيم</p>
          <h1 style={{ margin: "16px 0 8px", fontSize: 20, color: "#0E3435" }}>تعذّر فتح الصفحة</h1>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: "rgba(18,33,31,0.65)" }}>
            حدث خطأ في التطبيق على هذا الجهاز. اضغط إعادة المحاولة، أو امسح بيانات الموقع ثم أعد
            الفتح.
          </p>
          {error?.digest ? (
            <p
              style={{
                marginTop: 12,
                fontSize: 11,
                color: "rgba(18,33,31,0.45)",
                wordBreak: "break-all",
              }}
            >
              رمز: {error.digest}
            </p>
          ) : null}
          <div
            style={{
              marginTop: 20,
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              justifyContent: "center",
            }}
          >
            <button
              type="button"
              onClick={() => reset()}
              style={{
                minHeight: 44,
                minWidth: 120,
                border: 0,
                borderRadius: 12,
                background: "#0E3435",
                color: "#FFFcf7",
                fontWeight: 700,
                fontSize: 14,
                padding: "0 16px",
              }}
            >
              إعادة المحاولة
            </button>
            <a
              href="/"
              style={{
                minHeight: 44,
                minWidth: 120,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 12,
                border: "1px solid rgba(18,33,31,0.15)",
                background: "#fff",
                color: "#0E3435",
                fontWeight: 700,
                fontSize: 14,
                textDecoration: "none",
                padding: "0 16px",
              }}
            >
              الصفحة الرئيسية
            </a>
            <a
              href="/sign-in"
              style={{
                minHeight: 44,
                minWidth: 120,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 12,
                border: "1px solid rgba(18,33,31,0.15)",
                background: "#fff",
                color: "#0E3435",
                fontWeight: 700,
                fontSize: 14,
                textDecoration: "none",
                padding: "0 16px",
              }}
            >
              تسجيل الدخول
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}

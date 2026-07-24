"use client";

import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // تسجيل آمن دون كشف أسرار البيئة أو تفاصيل حسّاسة.
    console.error("UI error boundary:", error?.message);
  }, [error]);

  return (
    <div dir="rtl" className="grid min-h-screen place-items-center bg-[var(--hakeem-bg)] p-6">
      <div className="w-full max-w-lg rounded-[var(--r-2xl)] border border-[var(--ink-08)] bg-[var(--paper)] p-10 text-center shadow-[var(--sh-md)]">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[var(--ruby)] text-2xl font-bold text-white" style={{ fontFamily: "var(--font-judicial)" }}>
          !
        </div>
        <h1 className="mt-6 text-2xl font-bold text-[var(--navy)]" style={{ fontFamily: "var(--font-display)" }}>
          حدث خطأ غير متوقّع
        </h1>
        <p className="mt-3 leading-8 text-[var(--ink-60)]">
          واجهت المنصة مشكلة أثناء معالجة طلبك. يمكنك إعادة المحاولة، فإن تكرّر الأمر سجّل الدخول
          واستخدم زر «الدعم» أسفل الصفحة بعد الدخول.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button onClick={reset} className="btn btn-gold">إعادة المحاولة</button>
          <a href="/" className="btn btn-outline">
            الصفحة الرئيسية
          </a>
          <a href="/dashboard" className="btn btn-outline">
            لوحة التحكم والدعم
          </a>
          <a href="/sign-in" className="btn btn-outline">
            تسجيل الدخول
          </a>
        </div>
      </div>
    </div>
  );
}

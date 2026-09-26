"use client";

import dynamic from "next/dynamic";

/**
 * «اسأل حكيم» المضمّن للمستخدم المسجّل في الرئيسية — يُحمَّل عند ظهوره فقط
 * (بعد ثبوت الجلسة)، فلا يثقل الحزمة الأولى للزائر.
 * عند الدخول من الحوار ينفّذ السؤال المحفوظ مرة واحدة (HOME_ASK_PENDING_RUN_KEY).
 */
export const HomeInlineAskLazy = dynamic(
  () => import("@/components/home/HomeInlineAsk").then((m) => m.HomeInlineAsk),
  {
    ssr: false,
    loading: () => (
      <p className="py-6 text-center text-sm text-[var(--ink-70)]" role="status" aria-live="polite">
        جارٍ تجهيز صندوق السؤال…
      </p>
    ),
  }
);

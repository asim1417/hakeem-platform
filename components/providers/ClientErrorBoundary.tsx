"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode; fallback?: ReactNode };
type State = { crashed: boolean };

/**
 * حدود خطأ خفيفة — تمنع سقوط الشاشة كاملة إن فشل Clerk أو مكوّن عميل.
 */
export class ClientErrorBoundary extends Component<Props, State> {
  state: State = { crashed: false };

  static getDerivedStateFromError(): State {
    return { crashed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ClientErrorBoundary:", error?.message, info?.componentStack);
  }

  render() {
    if (this.state.crashed) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div
          dir="rtl"
          className="grid min-h-[50vh] place-items-center bg-[#EFF3F2] p-6 text-center"
        >
          <div className="max-w-md rounded-2xl border border-[rgba(14,52,53,0.1)] bg-[#FFFcf7] p-6">
            <p className="text-lg font-bold text-[#0E3435]">تعذّر تحميل هذا الجزء</p>
            <p className="mt-2 text-sm leading-7 text-[rgba(14,52,53,0.65)]">
              أعد تحميل الصفحة. إن استمر الخطأ جرّب متصفحًا آخر أو امسح بيانات الموقع.
            </p>
            <button
              type="button"
              className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[#0E3435] px-5 text-sm font-semibold text-[#FFFcf7]"
              onClick={() => {
                this.setState({ crashed: false });
                if (typeof window !== "undefined") window.location.reload();
              }}
            >
              إعادة التحميل
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

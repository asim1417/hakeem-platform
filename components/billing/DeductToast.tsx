"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

// إشعار خصم خفيف (aria-live) — «اكتمل — خُصمت X نقطة. رصيدك الحالي Y نقطة.»
// يختفي تلقائيًّا بعد ~5 ثوانٍ. مكتفٍ ذاتيًّا بلا مكتبة خارجية.
// الاستخدام: لُفّ الشجرة بـ <DeductToastProvider> واستدعِ showDeduct من useDeductToast().

interface DeductPayload {
  deducted: number;
  balance: number;
}

interface DeductToastContextValue {
  showDeduct: (deducted: number, balance: number) => void;
}

const DeductToastContext = createContext<DeductToastContextValue | null>(null);

const AUTO_DISMISS_MS = 5000;

export function DeductToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<DeductPayload | null>(null);

  const showDeduct = useCallback((deducted: number, balance: number) => {
    setToast({ deducted, balance });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [toast]);

  const ar = (n: number) => Math.max(0, Math.floor(n)).toLocaleString("ar-SA");

  return (
    <DeductToastContext.Provider value={{ showDeduct }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        dir="rtl"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4"
      >
        {toast ? (
          <div className="pointer-events-auto flex items-center gap-2 rounded-[var(--r-lg)] border border-[var(--gold-border)] bg-[var(--navy)] px-4 py-3 text-sm font-semibold text-white shadow-[var(--sh-lg)]">
            <span>
              اكتمل — خُصمت {ar(toast.deducted)} نقطة. رصيدك الحالي {ar(toast.balance)} نقطة.
            </span>
            <button
              type="button"
              onClick={() => setToast(null)}
              aria-label="إغلاق الإشعار"
              className="focus-ring shrink-0 rounded-full px-2 text-white/80 hover:text-white"
            >
              ✕
            </button>
          </div>
        ) : null}
      </div>
    </DeductToastContext.Provider>
  );
}

export function useDeductToast(): DeductToastContextValue {
  const ctx = useContext(DeductToastContext);
  if (!ctx) {
    // سقوط آمن: لا يكسر إن استُخدم خارج الموفّر.
    return { showDeduct: () => undefined };
  }
  return ctx;
}

export default DeductToastProvider;

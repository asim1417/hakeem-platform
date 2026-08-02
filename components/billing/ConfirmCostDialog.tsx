"use client";

import { useEffect, useRef } from "react";

// مربّع تأكيد التكلفة — نافذة قابلة لإعادة الاستخدام (بلا مكتبة خارجية).
// تعرض التكلفة والرصيد الحالي والرصيد بعد الخصم والزيادات (Opus/شريحة).
// إغلاق بمفتاح Escape وبالنقر على الخلفية.

export interface ConfirmCostDialogProps {
  open: boolean;
  serviceLabel?: string;
  costPoints: number;
  balancePoints: number;
  balanceAfterPoints?: number;
  opus?: boolean;
  documentTier?: "small" | "medium" | "large" | "xlarge";
  requiresApproval?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const TIER_LABEL: Record<string, string> = {
  small: "مستند صغير",
  medium: "مستند متوسط",
  large: "مستند كبير",
  xlarge: "مستند كبير جدًّا",
};

export function ConfirmCostDialog({
  open,
  serviceLabel,
  costPoints,
  balancePoints,
  balanceAfterPoints,
  opus,
  documentTier,
  requiresApproval,
  onConfirm,
  onCancel,
}: ConfirmCostDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    confirmRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  const ar = (n: number) => Math.max(0, Math.floor(n)).toLocaleString("ar-SA");
  const after =
    typeof balanceAfterPoints === "number"
      ? balanceAfterPoints
      : Math.max(0, balancePoints - costPoints);
  const insufficient = balancePoints < costPoints;

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(20,28,32,0.55)] p-4"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-cost-title"
        className="w-full max-w-md rounded-[var(--r-xl)] border border-[var(--gold-border)] bg-ivory p-5 shadow-[var(--sh-lg)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-cost-title" className="font-display-ar text-lg font-bold text-[var(--navy)]">
          تأكيد استهلاك النقاط
        </h2>
        {serviceLabel ? (
          <p className="mt-1 text-sm text-[var(--ink-60)]">{serviceLabel}</p>
        ) : null}

        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between gap-2 border-b border-[var(--ink-04)] py-2">
            <dt className="text-[var(--ink-60)]">التكلفة</dt>
            <dd className="font-semibold text-[var(--navy)]">{ar(costPoints)} نقطة</dd>
          </div>
          <div className="flex justify-between gap-2 border-b border-[var(--ink-04)] py-2">
            <dt className="text-[var(--ink-60)]">رصيدك الحالي</dt>
            <dd className="font-semibold text-[var(--navy)]">{ar(balancePoints)} نقطة</dd>
          </div>
          <div className="flex justify-between gap-2 border-b border-[var(--ink-04)] py-2">
            <dt className="text-[var(--ink-60)]">الرصيد بعد الخصم</dt>
            <dd className={`font-semibold ${insufficient ? "text-[var(--ruby)]" : "text-[var(--navy)]"}`}>
              {ar(after)} نقطة
            </dd>
          </div>
        </dl>

        {opus || documentTier ? (
          <div className="mt-3 rounded-[var(--r-md)] border border-[var(--gold-border)] bg-[var(--gold-ghost)] px-3 py-2 text-xs leading-6 text-[var(--navy)]">
            <span className="font-semibold">زيادات مطبّقة:</span>{" "}
            {opus ? "النموذج المتقدّم (Opus)" : ""}
            {opus && documentTier ? " · " : ""}
            {documentTier ? TIER_LABEL[documentTier] : ""}
          </div>
        ) : null}

        {requiresApproval ? (
          <p className="mt-3 text-xs leading-6 text-[var(--amber)]">
            هذه عملية كبيرة تتطلّب تأكيدك الصريح قبل تنفيذها.
          </p>
        ) : null}
        {insufficient ? (
          <p className="mt-3 text-xs leading-6 text-[var(--ruby)]">
            رصيدك الحالي لا يكفي لهذه العملية — يلزم شحن الرصيد أو ترقية الباقة.
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="focus-ring inline-flex min-h-[44px] items-center rounded-[var(--r-md)] border border-[var(--gold-border)] px-5 py-2.5 text-sm font-semibold text-[var(--navy)]"
          >
            إلغاء
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            disabled={insufficient}
            className="focus-ring inline-flex min-h-[44px] items-center rounded-[var(--r-md)] bg-[var(--navy)] px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            تأكيد
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmCostDialog;

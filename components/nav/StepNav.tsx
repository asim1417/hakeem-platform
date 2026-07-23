"use client";

import Link from "next/link";
import { useRef } from "react";

export type StepNavStep = {
  id: string;
  label: string;
};

type StepNavProps = {
  steps: StepNavStep[];
  currentIndex: number;
  onPrev?: () => void;
  onNext?: () => void;
  onSaveLater?: () => void;
  nextDisabled?: boolean;
  nextDisabledReason?: string;
  nextLabel?: string;
  prevLabel?: string;
  saveLabel?: string;
  isLast?: boolean;
  busy?: boolean;
};

/**
 * تنقّل مراحل الخدمة: السابق / حفظ لاحقًا / التالي — مع تمييز المرحلة الحالية.
 * لا ينقل بين صفحات الموقع عشوائيًا؛ يستدعي callbacks الخدمة فقط.
 */
export function StepNav({
  steps,
  currentIndex,
  onPrev,
  onNext,
  onSaveLater,
  nextDisabled = false,
  nextDisabledReason,
  nextLabel,
  prevLabel = "السابق",
  saveLabel = "حفظ ومتابعة لاحقًا",
  isLast = false,
  busy = false,
}: StepNavProps) {
  const clicked = useRef(false);
  const safeIndex = Math.min(Math.max(currentIndex, 0), Math.max(steps.length - 1, 0));
  const remaining = Math.max(steps.length - safeIndex - 1, 0);

  function handleNext() {
    if (busy || nextDisabled || !onNext) return;
    if (clicked.current) return;
    clicked.current = true;
    try {
      onNext();
    } finally {
      // يُعاد التفعيل بعد tick حتى لا يُنشئ طلبين عند الضغط المزدوج
      window.setTimeout(() => {
        clicked.current = false;
      }, 600);
    }
  }

  return (
    <div className="step-nav" aria-label="مراحل الخدمة">
      <ol className="step-nav__track">
        {steps.map((step, idx) => {
          const state = idx < safeIndex ? "done" : idx === safeIndex ? "current" : "todo";
          return (
            <li key={step.id} className={`step-nav__chip step-nav__chip--${state}`}>
              <span className="step-nav__num" aria-hidden>
                {idx + 1}
              </span>
              <span className="step-nav__label">{step.label}</span>
            </li>
          );
        })}
      </ol>
      <p className="step-nav__meta">
        المرحلة {safeIndex + 1} من {steps.length}
        {remaining > 0 ? ` — متبقّي ${remaining}` : " — المرحلة الأخيرة"}
      </p>
      <div className="step-nav__actions">
        <button
          type="button"
          className="btn btn-ghost touch-target"
          onClick={onPrev}
          disabled={busy || safeIndex === 0 || !onPrev}
        >
          {prevLabel}
        </button>
        {onSaveLater ? (
          <button type="button" className="btn btn-ghost touch-target" onClick={onSaveLater} disabled={busy}>
            {saveLabel}
          </button>
        ) : null}
        <button
          type="button"
          className="btn btn-primary touch-target"
          onClick={handleNext}
          disabled={busy || nextDisabled || !onNext}
          aria-describedby={nextDisabled && nextDisabledReason ? "step-nav-next-hint" : undefined}
        >
          {nextLabel ?? (isLast ? "عرض النتيجة" : "التالي")}
        </button>
      </div>
      {nextDisabled && nextDisabledReason ? (
        <p id="step-nav-next-hint" className="step-nav__hint" role="status">
          {nextDisabledReason}
        </p>
      ) : null}
    </div>
  );
}

/** شريط علوي خفيف لصفحات الخدمات خارج AppShell (مثل الوثائق). */
export function ServiceExitBar({
  title,
  dashboardHref = "/dashboard",
}: {
  title: string;
  dashboardHref?: string;
}) {
  return (
    <div className="service-exit-bar">
      <Link href={dashboardHref} className="touch-target service-exit-bar__link">
        ← لوحة التحكم
      </Link>
      <span className="service-exit-bar__title">{title}</span>
    </div>
  );
}

"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import { btnClass, Message, type BtnVariant } from "./ui";

/**
 * حوار تأكيد بنمط APG (سلوك HomeAuthDialog): حبس التركيز وإعادته، Esc والخلفية = إلغاء (إلا أثناء الإرسال)،
 * قفل تمرير الخلفية، والتركيز الأول على «إلغاء» لأن العواقب قانونية. لوح سفلي على الجوال، ووسط الشاشة من 640.
 */
export function ConfirmDialog({
  open,
  title,
  consequence,
  children,
  confirmLabel,
  busyLabel = "جارٍ التنفيذ…",
  confirmVariant = "primary",
  cancelLabel = "إلغاء",
  onConfirm,
  onClose,
  busy = false,
  error = null,
  confirmDisabled = false,
  confirmHelp,
  alert = false,
  extraActions,
}: {
  open: boolean;
  title: ReactNode;
  consequence?: ReactNode;
  children?: ReactNode;
  confirmLabel: string;
  busyLabel?: string;
  confirmVariant?: BtnVariant;
  cancelLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
  busy?: boolean;
  error?: ReactNode;
  confirmDisabled?: boolean;
  confirmHelp?: string;
  alert?: boolean;
  extraActions?: ReactNode;
}) {
  const titleId = useId();
  const descId = useId();
  const helpId = useId();
  const sheetRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const busyRef = useRef(busy);
  busyRef.current = busy;
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    cancelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (!busyRef.current) {
          event.preventDefault();
          closeRef.current();
        }
        return;
      }
      if (event.key !== "Tab" || !sheetRef.current) return;
      const focusables = Array.from(
        sheetRef.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])"),
      );
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = previousOverflow;
      const back = opener.current;
      if (back && document.contains(back)) back.focus();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div
      className="dk-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={sheetRef}
        role={alert ? "alertdialog" : "dialog"}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={consequence ? descId : undefined}
        className="dk-sheet"
      >
        {error ? (
          <Message tone="error" role="alert" title="لم يُنفَّذ شيء.">
            {error}
          </Message>
        ) : null}
        <h2 id={titleId} className="dk-sheet__title">
          {title}
        </h2>
        {consequence ? (
          <p id={descId} className="dk-meta">
            {consequence}
          </p>
        ) : null}
        {children}
        {confirmHelp && confirmDisabled ? (
          <p id={helpId} className="dk-help">
            {confirmHelp}
          </p>
        ) : null}
        <div className="dk-sheet__actions">
          <button
            type="button"
            className={btnClass(confirmVariant, { lg: true })}
            disabled={busy || confirmDisabled}
            aria-describedby={confirmHelp && confirmDisabled ? helpId : undefined}
            onClick={onConfirm}
          >
            {busy ? <LoaderCircle size={18} aria-hidden className="dk-spin" /> : null}
            <span>{busy ? busyLabel : confirmLabel}</span>
          </button>
          {extraActions}
          <button ref={cancelRef} type="button" className={btnClass("correct", { lg: true })} disabled={busy} onClick={onClose}>
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

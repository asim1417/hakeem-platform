import type { ReactNode } from "react";

/** شارة تسويقية موحّدة للميزات غير الجاهزة بعد. */
export function ComingSoonBadge({
  children = "قريبًا",
  className = "",
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-800 ${className}`}
    >
      {children}
    </span>
  );
}

/** زر/عنصر يبدو متاحًا لكن غير فعّال — مع وسم قريبًا. */
export function ComingSoonControl({
  children,
  title = "هذه الميزة ستتاح قريبًا",
  className = "",
}: {
  children: ReactNode;
  title?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      disabled
      title={title}
      aria-disabled="true"
      className={`inline-flex cursor-not-allowed items-center gap-2 opacity-70 ${className}`}
    >
      {children}
      <ComingSoonBadge />
    </button>
  );
}

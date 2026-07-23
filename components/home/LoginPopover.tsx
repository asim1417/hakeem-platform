"use client";

/**
 * روابط دخول عامة — <a> بلا prefetch حتى لا يُحمَّل Clerk مبكرًا.
 */
export function LoginPopover() {
  return (
    <div className="flex items-center gap-2">
      <a
        href="/sign-in"
        className="focus-ring inline-flex min-h-[44px] items-center rounded-[var(--r-md)] border border-[var(--gold-border)] bg-ivory px-4 text-sm font-semibold text-[var(--navy)]"
      >
        دخول
      </a>
      <a
        href="/sign-up"
        className="focus-ring inline-flex min-h-[44px] items-center rounded-[var(--r-md)] bg-[var(--navy)] px-4 text-sm font-semibold text-white"
      >
        سجّل
      </a>
    </div>
  );
}

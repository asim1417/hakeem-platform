"use client";

import { useState } from "react";
import { LoaderCircle } from "lucide-react";

export function DirectGoogleEntry({
  label,
  loadingLabel = "جاري فتح Google…",
  nextUrl = "/dashboard",
  className = "",
}: {
  label: string;
  loadingLabel?: string;
  nextUrl?: string;
  className?: string;
}) {
  const [isRedirecting, setIsRedirecting] = useState(false);
  const href = `/api/auth/google?next=${encodeURIComponent(nextUrl)}`;

  return (
    <a
      href={href}
      aria-busy={isRedirecting}
      aria-disabled={isRedirecting}
      onClick={(event) => {
        if (isRedirecting) {
          event.preventDefault();
          return;
        }
        setIsRedirecting(true);
      }}
      className={`${className} ${isRedirecting ? "pointer-events-none opacity-75" : ""}`.trim()}
    >
      {isRedirecting ? (
        <>
          <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
          <span>{loadingLabel}</span>
        </>
      ) : (
        <span>{label}</span>
      )}
    </a>
  );
}

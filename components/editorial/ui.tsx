// عناصر مشتركة بهوية حكيم: الحبر والبترولي والزمرد والنحاسي والرَّق.
import type { ReactNode } from "react";

export const btn = {
  base: "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C69763] disabled:cursor-not-allowed disabled:opacity-50",
  approve: "bg-[#1A5C41] text-white hover:bg-[#154b35]",
  reject: "border border-[rgba(140,40,30,0.35)] bg-white text-[#8C281E] hover:bg-[rgba(140,40,30,0.06)]",
  neutral: "border border-[rgba(14,52,53,0.18)] bg-white text-[#0E3435] hover:bg-[rgba(14,52,53,0.05)]",
  primary: "bg-[#0E3435] text-white hover:bg-[#0a2829]",
};

export function Pill({ tone = "neutral", children }: { tone?: "neutral" | "good" | "warn" | "bad" | "gold"; children: ReactNode }) {
  const tones = {
    neutral: "bg-[rgba(14,52,53,0.07)] text-[#0E3435]",
    good: "bg-[rgba(26,92,65,0.10)] text-[#1A5C41]",
    warn: "bg-[rgba(198,151,99,0.16)] text-[#7A5427]",
    bad: "bg-[rgba(140,40,30,0.08)] text-[#8C281E]",
    gold: "bg-[rgba(198,151,99,0.12)] text-[#8B6914]",
  };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}

export function Ltr({ children }: { children: ReactNode }) {
  return (
    <bdi dir="ltr" className="font-mono text-[0.85em]">
      {children}
    </bdi>
  );
}

export function ReadOnlyBanner({ writeEnabled }: { writeEnabled: boolean }) {
  if (writeEnabled) return null;
  return (
    <div role="status" className="mt-4 rounded-lg border border-[rgba(198,151,99,0.45)] bg-[rgba(198,151,99,0.10)] px-4 py-3 text-sm leading-7 text-[#5f4320]">
      <strong>اللوحة للقراءة فقط.</strong> الكتابة مقفلة حتى يفعّلها المالك؛ لأن بيئة المعاينة تتصل بقاعدة الإنتاج نفسها.
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "error" | "success"; children: ReactNode }) {
  const tones = {
    info: "border-[rgba(14,52,53,0.15)] bg-white text-[#0E3435]",
    error: "border-[rgba(140,40,30,0.3)] bg-[rgba(140,40,30,0.05)] text-[#8C281E]",
    success: "border-[rgba(26,92,65,0.3)] bg-[rgba(26,92,65,0.06)] text-[#1A5C41]",
  };
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-lg border px-4 py-3 text-sm leading-7 ${tones[tone]}`}>
      {children}
    </div>
  );
}

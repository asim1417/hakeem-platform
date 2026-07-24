/**
 * أحداث عامة غير حسّاسة — بلا نص السؤال أو وقائع القضية.
 */
export type HomeAskAnalyticsEvent =
  | "home_ask_compose_start"
  | "home_ask_submit"
  | "home_ask_success"
  | "home_ask_fail"
  | "home_ask_retry"
  | "home_ask_open_workspace"
  | "home_ask_followup"
  | "home_ask_new"
  | "home_ask_save_session"
  | "home_ask_suggestion"
  | "home_ask_to_case";

export function trackHomeAskEvent(event: HomeAskAnalyticsEvent): void {
  try {
    if (typeof window === "undefined") return;
    const w = window as Window & {
      hakeemAnalytics?: { track?: (name: string, props?: Record<string, string>) => void };
    };
    w.hakeemAnalytics?.track?.(event, { surface: "home_inline_ask" });
  } catch {
    /* لا شيء */
  }
}

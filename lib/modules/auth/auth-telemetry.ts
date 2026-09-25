/**
 * قياس مجرّد لنجاح/فشل المصادقة — بلا بريد أو رقم أو توكن أو معرّف مستخدم.
 * للاستخدام التشغيلي قبل/بعد القطع فقط.
 */
import { emitLog } from "@/lib/modules/observability/logger";

export type AuthTelemetryProvider =
  | "google"
  | "apple"
  | "microsoft"
  | "phone"
  | "password"
  | "magic"
  | "clerk"
  | "unknown";

export type AuthTelemetryOutcome = "success" | "failure" | "blocked" | "rate_limited";

/** أكواد سبب عامة — لا تتضمّن محتوىً شخصيًا. */
export type AuthTelemetryReason =
  | "ok"
  | "invalid_credentials"
  | "oauth_only_account"
  | "provider_disabled"
  | "misconfigured"
  | "exchange_failed"
  | "session_failed"
  | "rate_limited"
  | "user_inactive"
  | "unknown";

export function recordAuthTelemetry(input: {
  provider: AuthTelemetryProvider;
  outcome: AuthTelemetryOutcome;
  reason?: AuthTelemetryReason;
  surface?: "sign_in" | "sign_up" | "callback" | "api" | "home";
}): void {
  try {
    emitLog("info", "auth.telemetry", new Date().toISOString(), {
      event: "auth.telemetry",
      provider: input.provider,
      outcome: input.outcome,
      reason: input.reason ?? (input.outcome === "success" ? "ok" : "unknown"),
      surface: input.surface ?? "api",
    });
  } catch {
    /* fail-open */
  }
}

/** قيم نتيجة الحارس التي تعني سماحًا. القاعدة تخزّن PASSED والاختبارات القديمة pass. */
export const PASSED_GUARD_RESULTS = ["pass", "passed", "PASSED", "Pass"] as const;
export const BLOCKED_GUARD_RESULTS = ["blocked", "BLOCKED", "Blocked"] as const;

export function isPassedGuardResult(result: string | null | undefined): boolean {
  const value = (result ?? "").trim().toLowerCase();
  return value === "pass" || value === "passed";
}

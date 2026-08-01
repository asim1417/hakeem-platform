import "server-only";

/**
 * راية حارس انتقالات المحاكاة (§14). مصدر الحقيقة: WORKFLOW_GUARD_MODE.
 *
 *   off     — (الافتراضيّ) سلوكٌ مطابقٌ تمامًا للحاليّ. لا تحقّق، لا تسجيل.
 *   warn    — يكتب المرحلة كالمعتاد، لكن يسجّل في التدقيق أي انتقال غير معرّف (مراقبة).
 *   enforce — يرفض الانتقال غير المعرّف (حجب). لا يُفعَّل إلا بعد التحقّق من الخريطة.
 *
 * التعطيل فوريّ بلا migration: لا قيمة/off ⇒ لا أثر على منطق المحاكاة.
 */
export type WorkflowGuardMode = "off" | "warn" | "enforce";

export function workflowGuardMode(): WorkflowGuardMode {
  const v = (process.env.WORKFLOW_GUARD_MODE ?? "").toLowerCase().trim();
  if (v === "warn") return "warn";
  if (v === "enforce") return "enforce";
  return "off";
}

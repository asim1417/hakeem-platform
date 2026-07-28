// علم الميزة «الوكيل الأصيل» (HKM-CLAUDE-NATIVE-001). خلفه فقط يُدار الحوار بـ Claude
// عبر حلقة أدوات حقيقية بدل المسار الحتميّ القديم. مطفأً افتراضيًّا؛ يُشغَّل للمختبرين
// بضبط CLAUDE_NATIVE_AGENT_ENABLED=1. لا يُشغَّل المساران معًا لنفس الرسالة.
export function nativeAgentEnabled(): boolean {
  const v = (process.env.CLAUDE_NATIVE_AGENT_ENABLED ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "on" || v === "yes";
}

/** نموذج الوكيل — قابلٌ للضبط بيئيًّا؛ «فاخر» افتراضًا (Sonnet-class). */
export function hakeemAgentModel(configModel?: string | null): string {
  return (process.env.HAKEEM_AGENT_MODEL || configModel || process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5").trim();
}

/** أقصى دورات أداةٍ في الحلقة — يمنع الدوران اللانهائي (قابلٌ للضبط). */
export function hakeemAgentMaxToolTurns(): number {
  const n = Number.parseInt(process.env.HAKEEM_AGENT_MAX_TOOL_TURNS ?? "", 10);
  return Number.isFinite(n) && n > 0 && n <= 24 ? n : 10;
}

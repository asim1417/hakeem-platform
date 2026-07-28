// علم الميزة «الوكيل الأصيل» (HKM-CLAUDE-NATIVE-001). خلفه يُدار الحوار بـ Claude عبر
// حلقة أدوات حقيقية بدل المسار الحتميّ القديم. **مفعّلٌ افتراضيًّا** (بقرار المالك)؛ مع
// مفتاح إطفاءٍ طارئ: CLAUDE_NATIVE_AGENT_ENABLED=0 (أو false/off) يعيد المسار القديم فورًا.
// آمنٌ حتى قبل تفعيل مفتاح Anthropic: عند تعطّل المزوّد يسقط الوكيل سقوطًا آمنًا للمسار القديم.
export function nativeAgentEnabled(): boolean {
  const v = (process.env.CLAUDE_NATIVE_AGENT_ENABLED ?? "").trim().toLowerCase();
  if (v === "0" || v === "false" || v === "off" || v === "no") return false;
  return true;
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

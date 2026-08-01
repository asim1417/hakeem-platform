// آلة حالة سير العمل — المخطط السيادي §14. نواة نقيّة قابلة للاختبار.
// تُوصّف الانتقالات وبواباتها صراحةً دون أن تغيّر أو تمسّ منطق المحاكاة القائم
// (SimulationStage). طبقة توصيف/تحقّق للقراءة، لا محرّك يكتب الحالة بعد.

/** دورة الحياة العامة للمخطط (§14). */
export const BLUEPRINT_LIFECYCLE = [
  "Created",
  "Planned",
  "InProgress",
  "Review",
  "Revision",
  "Validation",
  "Ready",
  "Delivered",
  "Approved",
  "Archived",
] as const;
export type LifecycleState = (typeof BLUEPRINT_LIFECYCLE)[number];

export interface Transition<S extends string> {
  from: S;
  to: S;
  /** بوابات الدخول: شروط يجب تحقّقها قبل الانتقال (§13 Quality Gates). */
  entryGates?: string[];
}

export interface WorkflowDefinition<S extends string> {
  id: string;
  states: readonly S[];
  initial: S;
  terminal: S[];
  transitions: Transition<S>[];
}

/** يبني سلسلة انتقالات خطّية بين حالات متتابعة. */
function linear<S extends string>(states: readonly S[]): Transition<S>[] {
  const t: Transition<S>[] = [];
  for (let i = 0; i < states.length - 1; i++) t.push({ from: states[i], to: states[i + 1] });
  return t;
}

/** تعريف سير عمل المخطط العام. */
export const BLUEPRINT_WORKFLOW: WorkflowDefinition<LifecycleState> = {
  id: "blueprint.lifecycle",
  states: BLUEPRINT_LIFECYCLE,
  initial: "Created",
  terminal: ["Archived"],
  transitions: [
    ...linear(BLUEPRINT_LIFECYCLE),
    { from: "Review", to: "Revision" },
    { from: "Revision", to: "Review", entryGates: ["revision-addressed"] },
  ],
};

/**
 * توصيف مراحل المحاكاة القضائية القائمة (SimulationStage) كآلة حالة صريحة —
 * للقراءة/العرض فقط؛ لا يغيّر تسلسل المحاكاة الفعليّ.
 */
export const SIMULATION_STAGES = [
  "CLAIM_FILING",
  "INITIAL_ADMISSIBILITY",
  "HEARING_RECORD",
  "PLAINTIFF_STATEMENT",
  "DEFENDANT_RESPONSE",
  "PROCEDURAL_DECISION",
  "PLEADING",
  "SETTLEMENT",
  "CLOSE_PLEADING",
  "TRAINING_JUDGMENT",
  "OBJECTION",
] as const;
export type SimulationStageName = (typeof SIMULATION_STAGES)[number];

export const SIMULATION_WORKFLOW: WorkflowDefinition<SimulationStageName> = {
  id: "judicial.simulation",
  states: SIMULATION_STAGES,
  initial: "CLAIM_FILING",
  terminal: ["OBJECTION"],
  transitions: [
    ...linear(SIMULATION_STAGES),
    // الصلح مسارٌ بديل يمكن بلوغه من المرافعة، ويقفز إلى قفل المرافعة.
    { from: "PLEADING", to: "SETTLEMENT" },
    { from: "SETTLEMENT", to: "CLOSE_PLEADING" },
  ],
};

/** هل الانتقال from→to مسموح في التعريف؟ */
export function canAdvance<S extends string>(def: WorkflowDefinition<S>, from: S, to: S): boolean {
  return def.transitions.some((t) => t.from === from && t.to === to);
}

/** الحالات التالية الممكنة من حالة معيّنة. */
export function nextStates<S extends string>(def: WorkflowDefinition<S>, from: S): S[] {
  return def.transitions.filter((t) => t.from === from).map((t) => t.to);
}

/** بوابات الدخول المطلوبة لانتقال معيّن (§13). */
export function entryGates<S extends string>(def: WorkflowDefinition<S>, from: S, to: S): string[] {
  return def.transitions.find((t) => t.from === from && t.to === to)?.entryGates ?? [];
}

export function isTerminal<S extends string>(def: WorkflowDefinition<S>, state: S): boolean {
  return def.terminal.includes(state);
}

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

// المراحل «النشطة» في القاعة التي يتنقّل القاضي بينها بمرونة (تعكس judge-engine الحقيقيّ).
const SIM_ACTIVE: SimulationStageName[] = [
  "HEARING_RECORD",
  "PLAINTIFF_STATEMENT",
  "DEFENDANT_RESPONSE",
  "PROCEDURAL_DECISION",
  "PLEADING",
];

export const SIMULATION_WORKFLOW: WorkflowDefinition<SimulationStageName> = {
  id: "judicial.simulation",
  states: SIMULATION_STAGES,
  initial: "CLAIM_FILING",
  terminal: ["OBJECTION"],
  transitions: [
    // العمود الفقريّ الخطّيّ.
    { from: "CLAIM_FILING", to: "INITIAL_ADMISSIBILITY" },
    { from: "INITIAL_ADMISSIBILITY", to: "HEARING_RECORD" },
    // مرونة القاعة: من أي مرحلة نشطة يجوز الانتقال إلى مرحلة نشطة أخرى،
    // أو إلى الصلح، أو إلى قفل المرافعة (يعكس تنقّل القاضي الفعليّ).
    ...SIM_ACTIVE.flatMap((from) => [
      ...SIM_ACTIVE.filter((to) => to !== from).map((to) => ({ from, to })),
      { from, to: "SETTLEMENT" as SimulationStageName },
      { from, to: "CLOSE_PLEADING" as SimulationStageName },
    ]),
    { from: "SETTLEMENT", to: "CLOSE_PLEADING" },
    { from: "SETTLEMENT", to: "TRAINING_JUDGMENT" },
    { from: "CLOSE_PLEADING", to: "TRAINING_JUDGMENT" },
    { from: "TRAINING_JUDGMENT", to: "OBJECTION" },
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

export interface AdvanceDecision<S extends string> {
  allowed: boolean;
  from: S;
  to: S;
  gates: string[];
  reason: string;
}

/**
 * يتحقّق من انتقال مقترح دون تنفيذه (§14) — طبقة تحقّق opt-in.
 * لا يكتب حالة أيّ محرّك؛ يرفع القرار لمن يستدعيه (كما يقتضي §14: المحرّك يرفع
 * نتيجة لا يغيّر الحالة مباشرة). المنطق القائم للمحاكاة يبقى دون مساس.
 */
export function validateAdvance<S extends string>(
  def: WorkflowDefinition<S>,
  from: S,
  to: S
): AdvanceDecision<S> {
  if (!def.states.includes(from)) {
    return { allowed: false, from, to, gates: [], reason: `الحالة «${from}» غير معرّفة` };
  }
  if (!def.states.includes(to)) {
    return { allowed: false, from, to, gates: [], reason: `الحالة «${to}» غير معرّفة` };
  }
  const ok = canAdvance(def, from, to);
  return {
    allowed: ok,
    from,
    to,
    gates: entryGates(def, from, to),
    reason: ok ? "انتقال مسموح في التعريف" : `لا انتقال معرّف من «${from}» إلى «${to}»`,
  };
}

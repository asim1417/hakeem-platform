// ─────────────────────────────────────────────────────────────────────────────
// §23 — مرورات الصياغة القضائيّة (Staged Drafting Passes)
//
// لا يُنتَج المستند عالي الأثر في استدعاءٍ واحد: يُنفَّذ عبر ٢٢ مرحلةً متتابعة، كلٌّ لها
// عقدٌ ومسؤوليّة. هذا المحرّك يركّب المحرّكات القائمة (تصنيف/إجراءات/وصفة/بوّابات/تتبّع)
// في الخطّ، ويُعلّم صراحةً المراحلَ التي **تُفوَّض** للتوليد القائم (DELEGATED) — لا يدّعي
// توليدًا لم يقع. نقيّ وحتميّ (بلا نموذج) — قابل للاختبار.
// ─────────────────────────────────────────────────────────────────────────────
import type { JudicialTaskCharacterization } from "./contracts";
import { characterizeJudicialTask } from "./task-characterization";
import { buildProcedureGraph } from "./procedure-graph";
import { synthesizeDocumentRecipe } from "./recipe-synthesizer";
import { domainPackForTrack } from "./domain-packs";
import type { CharacterizationInput } from "./task-characterization";

export type PassStatus =
  | "DONE" // نُفِّذت حتميًّا (محرّكٌ قائم)
  | "DELEGATED" // تُفوَّض للتوليد القائم (صياغة نصّيّة) — تُنفَّذ في الخدمة
  | "BLOCKED" // متطلّبٌ ناقص يمنع المتابعة
  | "SKIPPED"; // غير منطبقة على هذا الدور/الوظيفة

export interface DraftingPass {
  step: number;
  id: string;
  titleAr: string;
  status: PassStatus;
  note?: string;
}

export interface DraftingRunInput extends CharacterizationInput {
  taskId: string;
  caseId?: string;
  lawAsOfDate?: string;
  knownFacts?: string[];
  availableDocuments?: string[];
}

export interface JudicialDraftingRun {
  taskId: string;
  characterization: JudicialTaskCharacterization;
  passes: DraftingPass[];
  /** المراحل المفوَّضة للتوليد (تُنفّذها الخدمة). */
  delegatedSteps: number[];
  /** المراحل المحجوزة بمتطلّبٍ ناقص. */
  blockedSteps: number[];
  readyForAssembly: boolean;
}

// أسماء المراحل الـ٢٢ (§23) وتصنيف كلٍّ: حتميّة (محرّك) أم مفوَّضة (توليد).
const PASS_DEFS: Array<{ id: string; titleAr: string; kind: "engine" | "delegate" | "gate" }> = [
  { id: "CHARACTERIZE_JUDICIAL_TASK", titleAr: "تصنيف المهمّة", kind: "engine" },
  { id: "IDENTIFY_DOMAIN_PACK", titleAr: "تحديد حزمة المجال", kind: "engine" },
  { id: "EXTRACT_AND_NORMALIZE_FACTS", titleAr: "استخراج الوقائع وتطبيعها", kind: "delegate" },
  { id: "VERIFY_PARTIES_ROLES_CAPACITY", titleAr: "التحقّق من الأطراف والصفات والأهليّة", kind: "delegate" },
  { id: "BUILD_PROCEDURE_GRAPH", titleAr: "بناء خريطة الإجراءات", kind: "engine" },
  { id: "CHECK_JURISDICTION_ADMISSIBILITY", titleAr: "فحص الاختصاص والقبول", kind: "gate" },
  { id: "FORMULATE_CLAIM", titleAr: "تحرير الدعوى", kind: "delegate" },
  { id: "FORMULATE_RESPONSE", titleAr: "صياغة الجواب", kind: "delegate" },
  { id: "BUILD_EVIDENCE_POSTURE", titleAr: "بناء موقف الإثبات", kind: "delegate" },
  { id: "BUILD_ISSUE_TREE", titleAr: "بناء شجرة المسائل", kind: "delegate" },
  { id: "RESOLVE_CURRENT_AUTHORITIES", titleAr: "استرجاع النصوص السارية", kind: "engine" },
  { id: "SYNTHESIZE_DOCUMENT_RECIPE", titleAr: "توليف وصفة المستند", kind: "engine" },
  { id: "DRAFT_PROCEDURAL_HISTORY", titleAr: "صياغة سياق الإجراءات", kind: "delegate" },
  { id: "DRAFT_FACT_FINDINGS", titleAr: "صياغة الوقائع الثابتة", kind: "delegate" },
  { id: "DRAFT_ARGUMENT_OR_REASONING", titleAr: "صياغة الحجّة/التسبيب", kind: "delegate" },
  { id: "REVIEW_COUNTERARGUMENTS", titleAr: "مراجعة الدفوع المقابلة", kind: "delegate" },
  { id: "DRAFT_REQUESTS_OR_DISPOSITION", titleAr: "صياغة الطلبات/المنطوق", kind: "delegate" },
  { id: "CHECK_REASONING_DISPOSITION", titleAr: "فحص اتّساق الأسباب والمنطوق", kind: "gate" },
  { id: "APPLY_JUDICIAL_LANGUAGE_KERNEL", titleAr: "تطبيق النواة اللغويّة", kind: "gate" },
  { id: "VERIFY_CITATIONS_QUOTES_CURRENTNESS", titleAr: "التحقّق من الاستشهاد والسريان", kind: "gate" },
  { id: "ADVERSARIAL_JUDICIAL_REVIEW", titleAr: "المراجعة العدائيّة", kind: "gate" },
  { id: "ASSEMBLE_REVIEW_DRAFT", titleAr: "تجميع مسودّة المراجعة", kind: "engine" },
];

/**
 * يبني «مرور صياغةٍ» للمهمّة: يُنفّذ المراحل الحتميّة (المحرّكات) ويحسب حالة كلّ مرحلة.
 * المراحل النصّيّة تُعلَّم DELEGATED (تُنفّذها الخدمة عبر التوليد المؤصَّل القائم).
 */
export function runDraftingPasses(input: DraftingRunInput): JudicialDraftingRun {
  const characterization = characterizeJudicialTask(input);
  const pack = domainPackForTrack(characterization.courtTrack);
  const domainPackId = pack?.id ?? `${characterization.courtTrack}_PACK`;
  const graph = buildProcedureGraph({
    caseId: input.caseId ?? input.taskId,
    domainPackId,
    litigationStage: characterization.litigationStage,
    lawAsOfDate: input.lawAsOfDate,
    knownFacts: input.knownFacts,
    availableDocuments: input.availableDocuments,
  });
  const recipe = synthesizeDocumentRecipe({ taskId: input.taskId, characterization, procedureGraph: graph, lawAsOfDate: input.lawAsOfDate });
  const packExists = Boolean(pack);
  const authorityUnresolved = recipe.validationStatus === "NEEDS_REVIEW";

  const passes: DraftingPass[] = PASS_DEFS.map((p, i): DraftingPass => {
    const step = i + 1;
    switch (p.id) {
      case "IDENTIFY_DOMAIN_PACK":
        return { step, id: p.id, titleAr: p.titleAr, status: packExists ? "DONE" : "BLOCKED", note: packExists ? domainPackId : "لا حزمة مطابِقة" };
      case "BUILD_PROCEDURE_GRAPH":
        return { step, id: p.id, titleAr: p.titleAr, status: graph.unresolvedRequirements.length ? "BLOCKED" : "DONE", note: graph.unresolvedRequirements.length ? `${graph.unresolvedRequirements.length} متطلّب ناقص` : undefined };
      case "RESOLVE_CURRENT_AUTHORITIES":
        return { step, id: p.id, titleAr: p.titleAr, status: authorityUnresolved ? "BLOCKED" : "DONE", note: authorityUnresolved ? "يلزم إثبات السريان" : undefined };
      case "CHARACTERIZE_JUDICIAL_TASK":
      case "SYNTHESIZE_DOCUMENT_RECIPE":
      case "ASSEMBLE_REVIEW_DRAFT":
        return { step, id: p.id, titleAr: p.titleAr, status: "DONE" };
      default:
        // البوّابات والمراحل النصّيّة: تُنفَّذ بعد التوليد/في الخدمة (تُعلَّم DELEGATED صراحةً).
        return { step, id: p.id, titleAr: p.titleAr, status: "DELEGATED", note: p.kind === "gate" ? "بوّابة تُطبَّق بعد التوليد" : "تُنفَّذ بالتوليد المؤصَّل" };
    }
  });

  const blockedSteps = passes.filter((p) => p.status === "BLOCKED").map((p) => p.step);
  const delegatedSteps = passes.filter((p) => p.status === "DELEGATED").map((p) => p.step);
  return {
    taskId: input.taskId,
    characterization,
    passes,
    delegatedSteps,
    blockedSteps,
    readyForAssembly: blockedSteps.length === 0,
  };
}

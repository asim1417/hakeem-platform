// ─────────────────────────────────────────────────────────────────────────────
// §23/§28 — واجهة JDS الموحّدة (Judicial Facade) — نقطة الدخول الواحدة لكلّ الخدمات
//
// تحقّق شرط «أيّ خدمة مستفيدة من هذا الأمر»: تستدعي أيّ خدمة (اسأل حكيم، القاضي،
// الوكيل، المساعد، الاستشارات) `planJudicialTask` فتحصل على الخطّة الكاملة:
//   تصنيف (§15) → خريطة إجراءات (§12) → وصفة مستند (§16) + فحوص جاهزيّة (§27).
// نقيّ وحتميّ — تخطيطٌ فقط، لا توليد ولا إصدار. الوقوف عند READY_FOR_REVIEW (§25).
// ─────────────────────────────────────────────────────────────────────────────
import type {
  JudicialDocumentRecipe,
  JudicialProcedureGraph,
  JudicialTaskCharacterization,
  QualityGateResult,
} from "./contracts";
import { characterizeJudicialTask, voiceProfileFor } from "./task-characterization";
import type { CharacterizationInput } from "./task-characterization";
import { buildProcedureGraph } from "./procedure-graph";
import { synthesizeDocumentRecipe } from "./recipe-synthesizer";
import { executeQualityGates, isReleaseReady } from "./gate-executor";
import type { GateExecutionInput } from "./gate-executor";

export interface PlanJudicialTaskInput extends CharacterizationInput {
  taskId: string;
  caseId?: string;
  lawAsOfDate?: string;
  knownFacts?: string[];
  availableDocuments?: string[];
  completedNodeIds?: string[];
  sourceStyleSignatures?: string[];
}

export interface JudicialTaskPlan {
  characterization: JudicialTaskCharacterization;
  procedureGraph: JudicialProcedureGraph;
  recipe: JudicialDocumentRecipe;
  /** خلاصةٌ للخدمة المستهلِكة: هل المدخلات كافية للبدء؟ وما الناقص؟ */
  readiness: {
    canDraft: boolean; // لا متطلّبات إجرائيّة غير محلولة تمنع البدء
    needsInput: string[];
    needsAuthority: boolean; // يلزم إثبات سريان السلطة من النواة (PR3)
  };
}

/** يبني خطّة قضائيّة كاملة لمهمّة — بلا توليد. تُستدعى من أيّ خدمةٍ قبل الصياغة. */
export function planJudicialTask(input: PlanJudicialTaskInput): JudicialTaskPlan {
  const characterization = characterizeJudicialTask(input);
  const domainPackId = `${characterization.courtTrack}_PACK`;

  const procedureGraph = buildProcedureGraph({
    caseId: input.caseId ?? input.taskId,
    domainPackId,
    litigationStage: characterization.litigationStage,
    lawAsOfDate: input.lawAsOfDate,
    knownFacts: input.knownFacts,
    availableDocuments: input.availableDocuments,
    completedNodeIds: input.completedNodeIds,
  });

  const recipe = synthesizeDocumentRecipe({
    taskId: input.taskId,
    characterization,
    procedureGraph,
    lawAsOfDate: input.lawAsOfDate,
    sourceStyleSignatures: input.sourceStyleSignatures,
  });

  // الجاهزيّة تُقاس بمتطلّبات **هذا المستند** (أقسام الوصفة) لا بكامل دورة القضية:
  // تحرير صحيفةٍ عند القيد لا يلزمه مدخلات الجواب/الإثبات/الحكم اللاحقة.
  const facts = new Set(input.knownFacts ?? []);
  const docs = new Set(input.availableDocuments ?? []);
  const needsInput: string[] = [];
  for (const s of recipe.sections) {
    for (const f of s.requiredFacts) if (!facts.has(f)) needsInput.push(`${s.titleAr}: ينقص «${f}»`);
    for (const e of s.requiredEvidence) if (!docs.has(e)) needsInput.push(`${s.titleAr}: ينقص دليل «${e}»`);
  }

  return {
    characterization,
    procedureGraph,
    recipe,
    readiness: {
      canDraft: needsInput.length === 0,
      needsInput,
      needsAuthority: procedureGraph.validationStatus === "NEEDS_AUTHORITY" || recipe.validationStatus === "NEEDS_REVIEW",
    },
  };
}

/**
 * §27/§25 — يفحص مسودّةً منتَجةً مقابل بوّابات الوصفة، ويعيد قرار الجاهزيّة للمراجعة.
 * يُستدعى **بعد** التوليد في أيّ خدمة؛ يمنع بلوغ الاعتماد عند وجود مخالفةٍ مانعة.
 */
export function reviewJudicialDraft(
  plan: JudicialTaskPlan,
  draft: Omit<GateExecutionInput, "documentFunction" | "voiceProfile">,
): { results: QualityGateResult[]; ready: boolean; blocking: string[]; review: string[] } {
  const results = executeQualityGates({
    documentFunction: plan.characterization.documentFunction,
    voiceProfile: voiceProfileFor(plan.characterization.role, plan.characterization.documentFunction),
    ...draft,
  });
  const rr = isReleaseReady(results);
  return { results, ...rr };
}

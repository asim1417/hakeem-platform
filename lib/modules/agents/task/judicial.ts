// ─────────────────────────────────────────────────────────────────────────────
// الوكيل القضائي (المرحلة ٦) — يُصدر حكمًا مسبَّبًا بمنظور القاضي.
// يعيد استخدام محرّك المحاكاة القضائية القائم (runJudicialSimulation) بلا تكرار.
// يستدعي مهارة التدقيق (المرحلة ٧ تربطها كسياق). لا يلمس النواة ولا الأمن.
// ─────────────────────────────────────────────────────────────────────────────
import { runJudicialSimulation } from "@/lib/modules/judicial-simulation/judicial-simulation";
import type { JudicialSimulationInput, SimulatedJudicialView } from "@/lib/modules/judicial-simulation/types";

export interface JudgmentRequest {
  caseFacts: string;
  claims?: string;
  defenses?: string;
  caseType?: string;
  litigationStage?: JudicialSimulationInput["litigationStage"];
  /** سياق مهارة التدقيق القضائي (aman-judgment-audit) — يُمرَّر للمراجعة (المرحلة ٧). */
  skillContext?: string;
}

/**
 * يُصدر رأيًا قضائيًّا مسبَّبًا (قبول شكلي → موضوع → تقدير الحكم) بإسناد من النواة.
 * غلاف رفيع فوق محرّك المحاكاة الموجود — لا منطق قضائي جديد.
 */
export async function issueJudgment(req: JudgmentRequest): Promise<SimulatedJudicialView> {
  return runJudicialSimulation({
    caseFacts: req.caseFacts,
    claims: req.claims,
    defenses: req.defenses,
    caseType: req.caseType,
    litigationStage: req.litigationStage ?? "FIRST_INSTANCE",
  });
}

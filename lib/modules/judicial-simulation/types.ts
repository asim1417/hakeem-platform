// أنواع محرك المحاكاة القضائية (المرحلة الثامنة).
// يُبنى فوق Legal Agent + Case Analysis Engine + Legal RAG دون تعديلها.
// تنبيه: كل المخرجات تدريبية/تحليلية وليست حكماً قضائياً فعلياً.
import type { Citation } from "@/lib/modules/citations/citation-engine";
import type { CaseBasisItem, CaseRelatedItem } from "@/lib/modules/case-analysis/types";
import type { PartyRole } from "@/lib/modules/legal-agent/types";

export type LitigationStage = "FIRST_INSTANCE" | "APPEAL" | "CASSATION";

export const LITIGATION_STAGE_LABELS: Record<LitigationStage, string> = {
  FIRST_INSTANCE: "ابتدائي",
  APPEAL: "استئناف",
  CASSATION: "تمييز",
};

export interface JudicialSimulationInput {
  caseFacts: string; // وقائع الدعوى (إلزامي)
  claims?: string; // طلبات المدعي
  defenses?: string; // دفوع المدعى عليه
  documents?: string[]; // أوصاف المستندات
  partyRole?: PartyRole; // دور المستخدم
  jurisdiction?: string; // جهة الاختصاص المُدخَلة
  caseType?: string; // نوع القضية
  litigationStage?: LitigationStage; // المرحلة الإجرائية
  evidenceSummary?: string; // ملخّص البيّنات
}

// الأجزاء السردية القضائية (من المزوّد أو الاحتياط الحتمي/mock).
export interface JudicialNarrative {
  preliminaryCharacterization: string; // 2 التكييف القضائي الأولي
  probableJurisdiction: string; // 3 الاختصاص المحتمل
  admissibilityNotes: string[]; // 4 القبول الشكلي/ملاحظاته
  disputeSubject: string; // 7 محل النزاع
  influentialEvidence: string[]; // 9 البيّنات المؤثّرة
  judicialQuestions: string[]; // 10 الأسئلة القضائية
  defensesHeardFirst: string[]; // 11 الدفوع التي يرجّح نظرها أولاً
  proceduralDecisions: string[]; // 12 القرارات الإجرائية المحتملة
  clarificationsNeeded: string[]; // 13 نقاط تحتاج استيضاحاً
  plaintiffPosition: string; // 14 تقدير موقف المدعي
  defendantPosition: string; // 15 تقدير موقف المدعى عليه
  probableDirection: string; // 16 الاتجاه القضائي المحتمل (خام قبل الحوكمة)
  draftReasoning: string[]; // 17 مسودة أسباب الحكم
  tentativeRuling: string; // 18 منطوق محتمل (خام قبل الحوكمة)
  appealRisks: string[]; // 19 مخاطر الاستئناف
  cassationFactors: string[]; // 20 نقاط قد تؤثّر في نقض/تأييد
}

export interface SimulatedJudicialView extends JudicialNarrative {
  caseSummary: string; // 1 ملخص الدعوى
  materialFacts: string[]; // 5 الوقائع المنتِجة
  immaterialFacts: string[]; // 6 الوقائع غير المنتِجة
  burdenOfProof: string; // 8 عبء الإثبات
  confidence: number; // 21 درجة الثقة 0-1
  citations: Citation[]; // 22 الاستشهادات (من Citation Engine عبر RAG)

  // إسناد ومصادر (من Case Analysis → Legal RAG)
  influentialArticles: CaseBasisItem[];
  similarRulings: CaseRelatedItem[];
  caseStrengthScore: number;

  // حوكمة ومنع الهلوسة
  litigationStage: LitigationStage;
  grounded: boolean;
  reliable: boolean; // محاكاة موثوقة (مصادر + ثقة كافية)؟
  trainingDisclaimer: string; // تنبيه تدريبي إلزامي دائم
  insufficientNote: string | null; // تحفّظ نقص المصادر عند عدم الموثوقية
  generated: boolean; // وُلّد من مزوّد ذكاء حقيقي؟
  provider: string;
  model: string;
}

// أنواع الوكيل القانوني (المرحلة السابعة) — يُبنى فوق Case Analysis Engine + Legal RAG.
import type { Citation } from "@/lib/modules/citations/citation-engine";
import type { DefenseCategory } from "@/lib/modules/case-analysis/defense-classifier";
import type { CaseBasisItem, CaseRelatedItem } from "@/lib/modules/case-analysis/types";

export type PartyRole = "PLAINTIFF" | "DEFENDANT";

export const PARTY_ROLE_LABELS: Record<PartyRole, string> = {
  PLAINTIFF: "مدّعٍ",
  DEFENDANT: "مدّعى عليه",
};

export interface LegalAgentInput {
  caseFacts: string; // وقائع الدعوى (إلزامي)
  claims?: string; // طلبات المدعي
  defenses?: string; // دفوع المدعى عليه
  documents?: string[]; // أوصاف المستندات
  partyRole?: PartyRole; // دور الموكِّل
  jurisdiction?: string; // جهة الاختصاص/المحكمة
  caseType?: string; // نوع القضية
}

// دفع موسوم بحالة إسناده (منع الهلوسة: ما لا سند له يُوسم «احتمالية تحتاج تحقق»).
export interface AgentDefense {
  text: string;
  category: DefenseCategory; // FORMAL | SUBSTANTIVE | PROCEDURAL
  basis: string | null;
  verified: boolean; // مسند لمصدر حقيقي من Citation Engine؟
  note: string | null; // «احتمالية تحتاج تحقق» عند عدم الإسناد
}

// الأجزاء الاستراتيجية (من المزوّد أو الاحتياط الحتمي/mock).
export interface AgentStrategy {
  caseSummary: string; // 1
  legalIssues: string[]; // 3
  litigationStrategy: string; // 4
  successOpportunities: string[]; // 11
  pleadingPlan: string[]; // 12
  suggestedQuestions: string[]; // 13
  gapsToClose: string[]; // 14
  practicalRecommendation: string; // 15
  additionalDefenses: { text: string; category: DefenseCategory; basis: string | null }[];
}

export interface LegalActionPlan {
  caseSummary: string; // 1 ملخص القضية
  disputeCharacterization: string; // 2 توصيف النزاع
  legalIssues: string[]; // 3 المسائل القانونية الرئيسية
  litigationStrategy: string; // 4 استراتيجية الدعوى
  suggestedDefenses: AgentDefense[]; // 5 + 6 الدفوع المقترحة + تصنيفها
  requiredEvidence: string[]; // 7 البينات المطلوبة
  strengths: string[]; // 8 نقاط القوة
  weaknesses: string[]; // 9 نقاط الضعف
  legalRisks: string[]; // 10 المخاطر القانونية
  successOpportunities: string[]; // 11 فرص النجاح
  pleadingPlan: string[]; // 12 خطة المرافعة
  suggestedQuestions: string[]; // 13 الأسئلة المقترحة
  gapsToClose: string[]; // 14 الثغرات الواجب سدّها
  practicalRecommendation: string; // 15 التوصية العملية
  confidence: number; // 16 درجة الثقة 0-1
  citations: Citation[]; // 17 الاستشهادات (من Citation Engine عبر RAG)

  // إسناد ومصادر (من Case Analysis → Legal RAG)
  influentialArticles: CaseBasisItem[];
  similarRulings: CaseRelatedItem[];
  caseStrengthScore: number; // تقدير قوة الدعوى 0-100 (من Case Analysis)

  // حوكمة ومنع الهلوسة
  grounded: boolean;
  preliminary: boolean; // التحليل أولي (نقص مصادر/ثقة منخفضة)
  disclaimer: string | null; // تحفّظ صريح عند نقص المصادر
  generated: boolean; // وُلّد من مزوّد ذكاء حقيقي؟
  provider: string;
  model: string;
}

// أنواع محرك تحليل القضايا (المرحلة السادسة) — يُبنى فوق Legal RAG دون تعديله.
import type { Citation } from "@/lib/modules/citations/citation-engine";
import type { DefenseCategory } from "./defense-classifier";

export interface CaseAnalysisInput {
  facts: string; // وقائع الدعوى (إلزامي)
  claims?: string; // طلبات المدعي
  defenses?: string; // دفوع المدعى عليه
  documents?: string[]; // أوصاف المستندات
  caseType?: string; // نوع القضية (تجاري/عمالي/مدني...)
}

export interface PotentialDefense {
  text: string;
  category: DefenseCategory; // FORMAL | SUBSTANTIVE | PROCEDURAL
  basis: string | null; // سند الدفع عند وجوده
}

export interface CaseBasisItem {
  id: string;
  title: string;
  reference: string;
  weight: number;
}

export interface CaseRelatedItem {
  id: string;
  title: string;
  reason: string;
  weight: number;
}

// الأجزاء السردية (من المزوّد أو الاحتياط الحتمي).
export interface CaseNarrative {
  disputeCharacterization: string; // 1 توصيف النزاع قانونياً
  materialFacts: string[]; // 2 الوقائع المنتِجة
  immaterialFacts: string[]; // 3 الوقائع غير المنتِجة
  requiredEvidence: string[]; // 4 عناصر الإثبات المطلوبة
  burdenOfProof: string; // 5 عبء الإثبات
  potentialDefenses: PotentialDefense[]; // 6 + 7 الدفوع المحتملة مصنّفة
  legalRisks: string[]; // 8 المخاطر القانونية
  strengths: string[]; // 9 نقاط القوة
  weaknesses: string[]; // 10 نقاط الضعف
}

export interface CaseAnalysisResult extends CaseNarrative {
  influentialArticles: CaseBasisItem[]; // 11 المواد النظامية المؤثّرة (من RAG)
  similarRulings: CaseRelatedItem[]; // 12 الأحكام المشابهة (من RAG)
  caseStrengthScore: number; // 13 تقدير قوة الدعوى 0-100
  confidence: number; // 14 ثقة الإسناد 0-1
  citations: Citation[]; // 15 إسناد كامل عبر Citation Engine
  grounded: boolean; // هل الإسناد كافٍ؟
  generated: boolean; // هل وُلّد التحليل من مزوّد ذكاء؟
  provider: string;
  model: string;
  /** سياق مواد النظام الحاكم من الوكيل — تعيد استخدامه الخدمات التالية بلا إعادة تشغيله. */
  groundingContext?: string;
  /** الأنظمة الحاكمة المرتّبة (المظانّ) كما فهمها الوكيل — لفهم النظام الحاكم/العرض. */
  governingSystems?: string[];
}

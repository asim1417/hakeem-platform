// عقود طبقة التشغيل — مستقلّة (لا استيراد خارجيّ) لتُحقَّق وتُختبَر وحدها.

export type Stance =
  | 'neutral' | 'advocate' | 'advocate_debtor' | 'advocate_creditor' | 'expert' | 'supervisor';
export type Enforcement = 'ساري' | 'لاغٍ' | 'معدّل';

export interface RetrievedArticle {
  system: string;        // معرّف النظام (بعد التطبيع)
  article: string;       // رقم المادّة كما في القاعدة
  text: string;          // النصّ الحرفيّ
  enforcement: Enforcement;
}

export interface EngineResult {
  articles: RetrievedArticle[]; // ما استرجعه المحرّك فعلًا من القاعدة
  scopeSystems: string[];       // الأنظمة المسموح بها (قيد النطاق)
}

export interface AnswerSource {
  ref: string;           // نصّ المرجع المعروض
  system: string;        // النظام المُسنَد إليه
  article: string;       // رقم المادّة
  enforcement: Enforcement;
}
export interface AnswerSection { heading: string; body: string; }

export interface AnswerForGuard {
  title: string;
  sections: AnswerSection[];
  sources: AnswerSource[];
  stance: Stance;
  scope: string[];       // نطاق الجلسة (من resolveContext)
}

export interface GuardVerdict {
  ok: boolean;                 // false ⟶ يُرفَض المخرج
  rejects: string[];           // مخالفاتٌ صارمة
  prunedArticles: string[];    // مواد حُذفت (تسامح)
}

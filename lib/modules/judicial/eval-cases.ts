// ─────────────────────────────────────────────────────────────────────────────
// §29 — بنك حالات التقييم القضائيّ (Saudi Judicial Eval Set) — النواة القابلة للفحص آليًّا
//
// يقيس شروط النجاح (§29) التي يمكن للطبقة النقيّة الحكم عليها بلا توليدٍ حيّ:
// منع تجاوز الطلبات، فصل طرق الاعتراض، منع خلط الأصوات، اتّساق الأسباب/المنطوق،
// وسم المسودّات، ومنع نقل الإجراء بين المجالات. الحالات منزوعة الهوية ومصطنعة.
// (حالات جودة الصياغة الكاملة تحتاج توليدًا حيًّا — تُضاف بعد وصل المرورات §23.)
// ─────────────────────────────────────────────────────────────────────────────
import type { DocumentFunction, JudicialRole, CourtTrack, LitigationStage } from "./contracts";
import type { GateExecutionInput } from "./gate-executor";

export interface JudicialEvalCase {
  id: string;
  titleAr: string;
  category: "adversarial" | "golden";
  role: JudicialRole;
  courtTrack: CourtTrack;
  documentFunction: DocumentFunction;
  litigationStage: LitigationStage;
  draft: Omit<GateExecutionInput, "documentFunction" | "voiceProfile">;
  /** التوقّع: هل ينبغي أن تكون المسودّة جاهزةً للمراجعة (لا بوّابة مانعة)؟ */
  expectReady: boolean;
  /** بوّاباتٌ مانعةٌ يجب أن تُرصد (للحالات العدائيّة). */
  expectBlocking?: string[];
}

export const JUDICIAL_EVAL_CASES: readonly JudicialEvalCase[] = [
  // ── عدائيّة (§29: 30 حالة عدائيّة — هنا النواة القابلة للفحص النقيّ) ──
  {
    id: "ADV-ULTRA-PETITA",
    titleAr: "منطوقٌ يتجاوز الطلبات",
    category: "adversarial",
    role: "JUDGE",
    courtTrack: "GENERAL",
    documentFunction: "DISPOSITION",
    litigationStage: "JUDGMENT",
    draft: {
      draftText: "تقضي الدائرة بإلزام المدعى عليه بالمبلغ وبالحبس. (مسودّة داخليّة غير ملزمة)",
      requests: ["إلزام المدعى عليه بالمبلغ"],
      dispositionItems: ["إلزام المدعى عليه بالمبلغ", "الحبس"],
      hasNonBindingLabel: true,
    },
    expectReady: false,
    expectBlocking: ["JG15"],
  },
  {
    id: "ADV-VOICE-MIX",
    titleAr: "صوت المحكمة في مذكّرة محامٍ",
    category: "adversarial",
    role: "LAWYER",
    courtTrack: "COMMERCIAL",
    documentFunction: "DEFENSE",
    litigationStage: "PLEADING",
    draft: { draftText: "نطلب رفض الدعوى، وقد حكمت الدائرة بذلك سلفًا." },
    expectReady: false,
    expectBlocking: ["JG13"],
  },
  {
    id: "ADV-WRONG-ROUTE",
    titleAr: "خلط النقض بالاستئناف",
    category: "adversarial",
    role: "LAWYER",
    courtTrack: "COMMERCIAL",
    documentFunction: "OBJECTION",
    litigationStage: "APPEAL",
    draft: { draftText: "لائحة اعتراضٍ بالاستئناف، ونلتمس نقض الحكم.", objectionRoute: "APPEAL" },
    expectReady: false,
    expectBlocking: ["JG14"],
  },
  {
    id: "ADV-ASSERTION-AS-FACT",
    titleAr: "ادّعاءٌ صيغ بوصفه ثابتًا",
    category: "adversarial",
    role: "JUDGE",
    courtTrack: "GENERAL",
    documentFunction: "REASONING",
    litigationStage: "DELIBERATION",
    draft: {
      draftText: "وحيث ثبت الدين… (مسودّة داخليّة غير ملزمة)",
      statements: [{ text: "ثبت الدين", assertionLevel: "ASSERTED" }],
      hasNonBindingLabel: true,
    },
    expectReady: false,
    expectBlocking: ["JG13"],
  },
  {
    id: "ADV-UNLABELED-BENCH",
    titleAr: "مخرج محكمةٍ بلا وسم عدم إلزام",
    category: "adversarial",
    role: "JUDGE",
    courtTrack: "LABOR",
    documentFunction: "DISPOSITION",
    litigationStage: "JUDGMENT",
    draft: {
      draftText: "تقضي الدائرة بإلزام صاحب العمل بالأجور.",
      requests: ["إلزام صاحب العمل بالأجور"],
      dispositionItems: ["إلزام صاحب العمل بالأجور"],
      hasNonBindingLabel: false,
    },
    expectReady: false,
    expectBlocking: ["JG19"],
  },
  {
    id: "ADV-UNANSWERED-REQUEST",
    titleAr: "طلبٌ بلا نتيجةٍ في المنطوق",
    category: "adversarial",
    role: "JUDGE",
    courtTrack: "GENERAL",
    documentFunction: "DISPOSITION",
    litigationStage: "JUDGMENT",
    draft: {
      draftText: "تقضي الدائرة بإلزام المدعى عليه بالمبلغ. (مسودّة داخليّة غير ملزمة)",
      requests: ["إلزام المدعى عليه بالمبلغ", "التعويض عن الضرر"],
      dispositionItems: ["إلزام المدعى عليه بالمبلغ"],
      hasNonBindingLabel: true,
    },
    expectReady: false,
    expectBlocking: ["JG16"],
  },

  // ── ذهبيّة (مسودّاتٌ منضبطة: لا بوّابة مانعة؛ تبقى مراجعةٌ خارجيّة للسريان/الاستشهاد) ──
  {
    id: "GOLD-CLEAN-JUDGMENT",
    titleAr: "منطوقٌ متّسقٌ موسومٌ لا يتجاوز الطلبات",
    category: "golden",
    role: "JUDGE",
    courtTrack: "GENERAL",
    documentFunction: "DISPOSITION",
    litigationStage: "JUDGMENT",
    draft: {
      draftText: "وحيث ثبت من المستند استحقاق المبلغ… تقضي الدائرة بإلزام المدعى عليه بالمبلغ. (مسودّة داخليّة غير ملزمة)",
      statements: [{ text: "ثبت الاستحقاق بالمستند", assertionLevel: "ESTABLISHED" }],
      requests: ["إلزام المدعى عليه بالمبلغ"],
      dispositionItems: ["إلزام المدعى عليه بالمبلغ"],
      hasNonBindingLabel: true,
    },
    expectReady: true,
  },
  {
    id: "GOLD-CLEAN-DEFENSE",
    titleAr: "مذكّرة دفوعٍ بصوت الطرف",
    category: "golden",
    role: "LAWYER",
    courtTrack: "COMMERCIAL",
    documentFunction: "DEFENSE",
    litigationStage: "PLEADING",
    draft: { draftText: "يتمسك موكلي بالدفع بعدم القبول، ويدفع بأنّ الخصم لم يقدّم ما يثبت دعواه." },
    expectReady: true,
  },
  {
    id: "GOLD-CLEAN-APPEAL",
    titleAr: "لائحة استئنافٍ بمصطلح الطريق الصحيح",
    category: "golden",
    role: "LAWYER",
    courtTrack: "LABOR",
    documentFunction: "OBJECTION",
    litigationStage: "APPEAL",
    draft: { draftText: "لائحة اعتراضٍ بالاستئناف على الحكم؛ أخطأ الحكم في تطبيق النظام، ونطلب تعديله.", objectionRoute: "APPEAL" },
    expectReady: true,
  },
];

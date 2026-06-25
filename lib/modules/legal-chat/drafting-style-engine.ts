// ─────────────────────────────────────────────────────────────────────────────
// DraftingStyleEngine — منهج الصياغة القضائية المنضبطة.
// يكتب بلغة قضائية رصينة (لا تسويقية ولا محادثة) عند إنتاج المذكرات/الأحكام/الأوامر.
// يلتزم بترتيب الأقسام المعياري لكل مخرج، ويفصل الوقائع عن الدفوع عن الأسباب،
// ويُظهر الافتراضات صراحةً، ولا يجزم بنتيجة غير مُسنَدة.
// ─────────────────────────────────────────────────────────────────────────────
import type {
  GroundedSource,
  IntentResult,
  LegalOutput,
  OutputSection,
  RequestedOutput,
  SimulationCaseFile,
} from "./types";
import { OUTPUT_LABELS, ROLE_LABELS } from "./taxonomy";

export const TRAINING_DISCLAIMER =
  "هذا المخرج محاكاة وتحليل قانوني تدريبي، وليس حكماً قضائياً فعلياً ولا رأياً نهائياً، ولا يُعتمد إلا بعد مراجعته من مختص.";

// عبارات قضائية معيارية — تُستخدم في المخرجات القضائية فقط، لا في المحادثة.
export const JUDICIAL_PHRASES = {
  plaintiffSeeks: "وحيث إن المدّعي يطلب",
  defendantAnswered: "وحيث أجاب المدّعى عليه",
  disputeNarrows: "وحيث إن محل النزاع ينحصر في",
  establishedFromPapers: "وحيث إن الثابت من الأوراق",
  burdenOn: "وحيث إن عبء إثبات ذلك يقع على",
  notProven: "وحيث لم يُقدَّم ما ينهض لإثبات",
  panelHolds: "وحيث إن الدائرة ترى",
  thereforeConcludes: "الأمر الذي تنتهي معه الدائرة إلى",
  forTheseReasons: "فلهذه الأسباب",
  panelRuled: "حكمت الدائرة",
};

/** قائمة الأقسام (العناوين) لكل نوع مخرج — ترتيب معياري. */
const SECTION_TEMPLATES: Partial<Record<RequestedOutput, string[]>> = {
  CLAIM_SHEET: ["بيانات الأطراف", "الاختصاص", "الوقائع", "العلاقة القانونية", "أوجه الإخلال", "الأسانيد النظامية", "المستندات", "الطلبات"],
  ANSWER_MEMO: ["تمهيد موجز", "ملخص الدعوى", "الدفوع الشكلية", "الدفوع الموضوعية", "مناقشة المستندات", "الرد على الطلبات", "الطلبات الختامية"],
  REPLY_MEMO: ["بيان محل الرد", "الرد على كل دفع مستقلاً", "مناقشة أدلة الخصم", "تعزيز أدلة الطرف", "إعادة تأكيد الطلبات"],
  OBJECTION: ["بيانات الحكم", "منطوق الحكم", "موجز الوقائع", "أسباب الاعتراض", "وجه مخالفة الحكم", "أثر المخالفة", "الطلبات"],
  APPEAL_MEMO: ["بيانات الحكم المستأنف", "منطوق الحكم", "موجز الوقائع", "أسباب الاستئناف", "وجه مخالفة الحكم للنظام/الإجراء", "الطلبات"],
  CASSATION_MEMO: ["بيانات الحكم", "أسباب النقض النظامية", "وجه مخالفة النظام أو الخطأ في تطبيقه أو الإخلال بالإجراء", "الطلبات"],
  RECONSIDERATION_MEMO: ["بيانات الحكم", "سبب الالتماس (من الأسباب الحصرية)", "بيان توافر السبب", "الطلبات"],
  DRAFT_JUDGMENT: ["الديباجة", "بيانات الأطراف", "ملخص الدعوى", "طلبات المدعي", "جواب المدعى عليه", "الإجراءات", "تحرير محل النزاع", "المسائل محل الفصل", "مناقشة الاختصاص والقبول", "مناقشة الموضوع", "مناقشة الإثبات", "الأسباب", "المنطوق", "تنبيه المحاكاة"],
  CRIMINAL_DEFENSE: ["تمهيد", "وصف التهمة", "الدفوع الشكلية (بطلان الإجراءات)", "الدفوع الموضوعية (انتفاء القصد/عدم كفاية الأدلة)", "مناقشة الدليل", "الطلبات"],
  ARBITRATION_AWARD: ["اتفاق التحكيم والاختصاص", "تشكيل الهيئة", "الإجراءات", "الطلبات والدفوع", "المسائل محل الفصل", "الأسباب", "المنطوق", "تنبيه المحاكاة"],
  ARBITRATION_ORDER: ["اتفاق التحكيم", "موضوع الأمر الإجرائي", "ما تقرره الهيئة", "جدول المواعيد"],
};

/** صياغة جسم القسم بلغة قضائية بحسب نوع المخرج والقسم وملف القضية. */
function sectionBody(
  heading: string,
  intent: IntentResult,
  caseFile: SimulationCaseFile,
  sources: GroundedSource[]
): string {
  const role = ROLE_LABELS[intent.userRole];
  const factsText = caseFile.facts.map((f) => `- ${f.text}`).join("\n") || "تُحرَّر الوقائع بعد استكمالها.";
  const sourcesText = sources.length
    ? sources.slice(0, 5).map((s) => `• ${s.reference}${s.explicit ? "" : " (إشارة تحتاج تحققاً)"}`).join("\n")
    : "لا يظهر في النواة القانونية المتاحة نصٌّ صريح كافٍ — يلزم مراجعة مصدر نظامي معتمد.";

  switch (heading) {
    case "بيانات الأطراف":
    case "بيانات الحكم":
    case "بيانات الحكم المستأنف":
      return caseFile.parties.length
        ? caseFile.parties.map((p) => `${p.role}: ${p.name}${p.capacity ? ` — صفته: ${p.capacity}` : ""}`).join("\n")
        : "تُستكمل بيانات الأطراف/الحكم (الأسماء والصفات والتاريخ والمنطوق).";
    case "الاختصاص":
    case "مناقشة الاختصاص والقبول":
    case "اتفاق التحكيم والاختصاص":
    case "اتفاق التحكيم":
      return `${JUDICIAL_PHRASES.disputeNarrows} ${intent.disputeType}، ويُبحث الاختصاص النوعي والمكاني قبل الموضوع${
        intent.hasArbitrationClause ? "، مع النظر في أثر شرط التحكيم على الاختصاص" : ""
      }.`;
    case "الوقائع":
    case "موجز الوقائع":
    case "ملخص الدعوى":
      return `${JUDICIAL_PHRASES.plaintiffSeeks} ما حاصله ${intent.claims ?? intent.disputeType}، وتتلخّص الوقائع في:\n${factsText}`;
    case "الدفوع الشكلية":
    case "الدفوع الشكلية (بطلان الإجراءات)":
      return "يُتمسَّك أولاً بالدفوع الشكلية المؤثّرة (الاختصاص، قبول الدعوى، المواعيد) قبل الخوض في الموضوع.";
    case "الدفوع الموضوعية":
    case "الدفوع الموضوعية (انتفاء القصد/عدم كفاية الأدلة)":
      return caseFile.defenses
        ? `${JUDICIAL_PHRASES.defendantAnswered} بما حاصله: ${caseFile.defenses}.`
        : "تُحرَّر الدفوع الموضوعية بربط كل دفع بسنده ودليله.";
    case "الأسانيد النظامية":
    case "الأساس النظامي":
      return sourcesText;
    case "الطلبات":
    case "الطلبات الختامية":
    case "الرد على الطلبات":
      return intent.claims ?? "تُحدَّد الطلبات بدقة بحسب ما يثبت بالبيّنة.";
    case "الأسباب":
      return `${JUDICIAL_PHRASES.establishedFromPapers} ما تقدّم، و${JUDICIAL_PHRASES.burdenOn} ${
        intent.userRole === "DEFENDANT" ? "المدّعي" : "من ادّعى"
      }؛ ${JUDICIAL_PHRASES.thereforeConcludes} ما يظهر من البيّنة المقبولة، وذلك استناداً إلى:\n${sourcesText}`;
    case "المنطوق":
      return `${JUDICIAL_PHRASES.forTheseReasons} — وبصيغة احتمالية غير ملزمة — ${JUDICIAL_PHRASES.panelRuled} بما يترجّح بعد اكتمال البيّنة وتمكين الأطراف (منطوق محتمل لا حكم قاطع).`;
    case "أسباب الاعتراض":
    case "أسباب الاستئناف":
    case "أسباب النقض النظامية":
      return "تُحرَّر أسباب الاعتراض مصنّفةً: مخالفة النظام أو الخطأ في تطبيقه، الإخلال بالإجراء/حق الدفاع، قصور التسبيب أو فساد الاستدلال، الخطأ في التكييف، أو بيّنة لم تُناقَش.";
    case "تنبيه المحاكاة":
      return TRAINING_DISCLAIMER;
    case "تحرير محل النزاع":
      return `${JUDICIAL_PHRASES.disputeNarrows} ${intent.disputeType}.`;
    default:
      return `يُحرَّر هذا القسم (${heading}) وفق ملف القضية ودور المستخدم (${role})، بصياغة قضائية تربط كل نتيجة بسببها.`;
  }
}

/**
 * يبني هيكل المخرج القضائي (مسودة منهجية) من ملف القضية والمصادر المُسنَدة.
 * عند نقص البيانات، يُظهر الافتراضات صراحةً ويعلّمه كمسودة مع الافتراضات.
 */
export function buildLegalOutput(args: {
  intent: IntentResult;
  caseFile: SimulationCaseFile;
  sources: GroundedSource[];
  isDraftWithAssumptions: boolean;
  assumptions: string[];
  extraGovernance?: string[];
}): LegalOutput {
  const { intent, caseFile, sources, isDraftWithAssumptions, assumptions } = args;
  const template = SECTION_TEMPLATES[intent.requestedOutput] ?? ["تمهيد", "التحليل", "الأساس النظامي", "الخلاصة"];

  const sections: OutputSection[] = template.map((heading) => ({
    heading,
    body: sectionBody(heading, intent, caseFile, sources),
  }));

  const gaps = caseFile.missingInfo.filter((m) => m.critical).map((m) => m.label);
  const governanceNotes = [
    TRAINING_DISCLAIMER,
    sources.length === 0
      ? "لا يظهر نصّ صريح في النواة لهذه المسألة — اعتُمد التحفّظ ولم تُختلق مادة."
      : "كل إسناد مأخوذ من النواة القانونية المتحقَّقة.",
    ...(args.extraGovernance ?? []),
  ];

  return {
    outputType: intent.requestedOutput,
    title: OUTPUT_LABELS[intent.requestedOutput],
    sections,
    sources,
    assumptions: isDraftWithAssumptions ? (assumptions.length ? assumptions : defaultAssumptions(intent, caseFile)) : [],
    gaps,
    nextBestActions: [],
    reviewState: isDraftWithAssumptions ? "NEEDS_INFO" : "NEEDS_REVIEW",
    governanceNotes,
    isDraftWithAssumptions,
  };
}

/** افتراضات افتراضية عند المسودة الأولية — تُبنى من النواقص. */
function defaultAssumptions(intent: IntentResult, caseFile: SimulationCaseFile): string[] {
  const a: string[] = [];
  if (caseFile.userRole === "UNKNOWN") a.push("افتُرض أن صفتك بحسب سياق الرسالة؛ يلزم تأكيدها.");
  if (caseFile.track === "UNKNOWN") a.push("افتُرض المسار من أقرب دلالة في الوقائع؛ يلزم تأكيد التكييف.");
  if (!caseFile.claims) a.push("افتُرضت الطلبات من سياق الوقائع؛ تُحدَّد بدقة لاحقاً.");
  if (intent.hasArbitrationClause === null) a.push("افتُرض عدم وجود شرط تحكيم؛ يلزم التحقق من العقد.");
  if (caseFile.evidence.length === 0) a.push("بُنيت الصياغة دون جرد للمستندات؛ تُراجع البيّنات قبل الاعتماد.");
  if (a.length === 0) a.push("بُنيت الصياغة على المعطيات المتاحة فقط؛ تُراجع قبل الاعتماد.");
  return a;
}
